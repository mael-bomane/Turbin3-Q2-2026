import { describe, it, before } from "mocha";
import { expect } from "chai";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  airdropFactory,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  lamports,
  none,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type KeyPairSigner,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";

import { getCreateAccountInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToInstruction,
} from "@solana-program/token";

import {
  fetchConfig,
  findConfigPda,
  findMintLpPda,
  getDepositInstructionAsync,
  getInitializeInstructionAsync,
  getSwapInstructionAsync,
  getWithdrawInstructionAsync,
} from "../../../sdk/src/generated";

const RPC_URL = "http://127.0.0.1:8899";
const WS_URL = "ws://127.0.0.1:8900";
const DECIMALS = 6;
const FEE_BPS = 30; // 0.3%
const INITIAL_X = 1_000_000_000n; // 1000 tokens of mintX in user wallet
const INITIAL_Y = 2_000_000_000n;
const DEPOSIT_X = 100_000_000n; // first-deposit seeds the pool
const DEPOSIT_Y = 200_000_000n;
const LP_TARGET = 100_000_000n; // ignored on first deposit but must be nonzero
const SWAP_IN = 10_000_000n;

function loadWalletSigner(): Promise<KeyPairSigner> {
  const path = join(homedir(), ".config/solana/id.json");
  const secret = Uint8Array.from(JSON.parse(readFileSync(path, "utf8")));
  return createKeyPairSignerFromBytes(secret);
}

async function send(
  rpc: Rpc<SolanaRpcApi>,
  sendAndConfirm: ReturnType<typeof sendAndConfirmTransactionFactory>,
  payer: KeyPairSigner,
  instructions: any[],
): Promise<string> {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const signed = await signTransactionMessageWithSigners(message);
  await sendAndConfirm(signed as any, { commitment: "confirmed" });
  return getSignatureFromTransaction(signed);
}

async function createMint(
  rpc: Rpc<SolanaRpcApi>,
  sendAndConfirm: ReturnType<typeof sendAndConfirmTransactionFactory>,
  payer: KeyPairSigner,
  authority: Address,
): Promise<Address> {
  const mint = await generateKeyPairSigner();
  const space = BigInt(getMintSize());
  const rent = await rpc.getMinimumBalanceForRentExemption(space).send();
  await send(rpc, sendAndConfirm, payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: rent,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMintInstruction({
      mint: mint.address,
      decimals: DECIMALS,
      mintAuthority: authority,
    }),
  ]);
  return mint.address;
}

async function createAtaAndMint(
  rpc: Rpc<SolanaRpcApi>,
  sendAndConfirm: ReturnType<typeof sendAndConfirmTransactionFactory>,
  payer: KeyPairSigner,
  mintAuthority: KeyPairSigner,
  mint: Address,
  owner: Address,
  amount: bigint,
): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({
    owner,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint,
  });
  await send(rpc, sendAndConfirm, payer, [
    await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer,
      ata,
      owner,
      mint,
    }),
    getMintToInstruction({
      mint,
      token: ata,
      mintAuthority,
      amount,
    }),
  ]);
  return ata;
}

describe("anchor-amm (codama SDK)", () => {
  const rpc = createSolanaRpc(RPC_URL);
  const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  const airdrop = airdropFactory({ rpc, rpcSubscriptions });

  let user: KeyPairSigner;
  let mintX: Address;
  let mintY: Address;
  let configPda: Address;
  const seed = BigInt(Math.floor(Math.random() * 2 ** 32));

  before(async () => {
    user = await loadWalletSigner();

    await airdrop({
      recipientAddress: user.address,
      lamports: lamports(5_000_000_000n),
      commitment: "confirmed",
    });

    // Ensure mintX < mintY ordering is not required by program; pool indexes both.
    mintX = await createMint(rpc, sendAndConfirm, user, user.address);
    mintY = await createMint(rpc, sendAndConfirm, user, user.address);

    await createAtaAndMint(rpc, sendAndConfirm, user, user, mintX, user.address, INITIAL_X);
    await createAtaAndMint(rpc, sendAndConfirm, user, user, mintY, user.address, INITIAL_Y);

    [configPda] = await findConfigPda({ seed });
  });

  it("initialize: creates pool config, mintLp, and vaults", async () => {
    const ix = await getInitializeInstructionAsync({
      payer: user,
      mintX,
      mintY,
      seed,
      fee: FEE_BPS,
      authority: none(),
    });
    await send(rpc, sendAndConfirm, user, [ix]);

    const account = await fetchConfig(rpc, configPda);
    expect(account.data.seed).to.equal(seed);
    expect(account.data.mintX).to.equal(mintX);
    expect(account.data.mintY).to.equal(mintY);
    expect(account.data.fee).to.equal(FEE_BPS);
    expect(account.data.locked).to.equal(false);
  });

  it("deposit: seeds vaults and mints LP on first deposit", async () => {
    const ix = await getDepositInstructionAsync({
      user,
      mintX,
      mintY,
      config: configPda,
      amount: LP_TARGET,
      maxX: DEPOSIT_X,
      maxY: DEPOSIT_Y,
    });
    await send(rpc, sendAndConfirm, user, [ix]);

    const [vaultXAta] = await findAssociatedTokenPda({
      owner: configPda,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      mint: mintX,
    });
    const [vaultYAta] = await findAssociatedTokenPda({
      owner: configPda,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      mint: mintY,
    });
    const [mintLpPda] = await findMintLpPda({ config: configPda });
    const [userLpAta] = await findAssociatedTokenPda({
      owner: user.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      mint: mintLpPda,
    });

    const vaultX = await fetchToken(rpc, vaultXAta);
    const vaultY = await fetchToken(rpc, vaultYAta);
    const userLp = await fetchToken(rpc, userLpAta);
    expect(vaultX.data.amount).to.equal(DEPOSIT_X);
    expect(vaultY.data.amount).to.equal(DEPOSIT_Y);
    expect(userLp.data.amount).to.equal(LP_TARGET);
  });

  it("withdraw: burns LP and returns proportional x/y", async () => {
    const [vaultXAta] = await findAssociatedTokenPda({
      owner: configPda,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      mint: mintX,
    });
    const [vaultYAta] = await findAssociatedTokenPda({
      owner: configPda,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      mint: mintY,
    });
    const [mintLpPda] = await findMintLpPda({ config: configPda });
    const [userLpAta] = await findAssociatedTokenPda({
      owner: user.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      mint: mintLpPda,
    });

    const lpBefore = (await fetchToken(rpc, userLpAta)).data.amount;
    const vaultXBefore = (await fetchToken(rpc, vaultXAta)).data.amount;
    const vaultYBefore = (await fetchToken(rpc, vaultYAta)).data.amount;
    const burn = lpBefore / 2n;

    const ix = await getWithdrawInstructionAsync({
      user,
      mintX,
      mintY,
      config: configPda,
      amount: burn,
      minX: 1n,
      minY: 1n,
    });
    await send(rpc, sendAndConfirm, user, [ix]);

    const lpAfter = (await fetchToken(rpc, userLpAta)).data.amount;
    const vaultXAfter = (await fetchToken(rpc, vaultXAta)).data.amount;
    const vaultYAfter = (await fetchToken(rpc, vaultYAta)).data.amount;
    expect(lpBefore - lpAfter).to.equal(burn);
    expect(vaultXBefore > vaultXAfter).to.equal(true);
    expect(vaultYBefore > vaultYAfter).to.equal(true);
  });

  it("swap: x -> y reduces userX and increases userY", async () => {
    const [userXAta] = await findAssociatedTokenPda({
      owner: user.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      mint: mintX,
    });
    const [userYAta] = await findAssociatedTokenPda({
      owner: user.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      mint: mintY,
    });
    const beforeX = (await fetchToken(rpc, userXAta)).data.amount;
    const beforeY = (await fetchToken(rpc, userYAta)).data.amount;

    const ix = await getSwapInstructionAsync({
      user,
      mintX,
      mintY,
      config: configPda,
      isX: true,
      amountIn: SWAP_IN,
      minAmountOut: 1n,
    });
    await send(rpc, sendAndConfirm, user, [ix]);

    const afterX = (await fetchToken(rpc, userXAta)).data.amount;
    const afterY = (await fetchToken(rpc, userYAta)).data.amount;
    expect(beforeX - afterX).to.equal(SWAP_IN);
    expect(afterY > beforeY).to.equal(true);
  });
});
