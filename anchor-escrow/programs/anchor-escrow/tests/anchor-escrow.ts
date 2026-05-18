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
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToInstruction,
} from "@solana-program/token";

import {
  fetchEscrow,
  findEscrowPda,
  getMakeInstructionAsync,
  getRefundInstructionAsync,
  getTakeInstructionAsync,
} from "../../../sdk/src/generated";

const RPC_URL = "http://127.0.0.1:8899";
const WS_URL = "ws://127.0.0.1:8900";
const DECIMALS = 6;
const AMOUNT_A = 1_000_000n; // 1 token of mintA
const AMOUNT_B = 2_000_000n; // 2 tokens of mintB

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

describe("anchor-escrow (codama SDK)", () => {
  const rpc = createSolanaRpc(RPC_URL);
  const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  const airdrop = airdropFactory({ rpc, rpcSubscriptions });

  let maker: KeyPairSigner;
  let taker: KeyPairSigner;
  let mintA: Address;
  let mintB: Address;
  const seed = BigInt(Math.floor(Math.random() * 2 ** 32));

  before(async () => {
    const payer = await loadWalletSigner();
    maker = payer;
    taker = await generateKeyPairSigner();

    await airdrop({
      recipientAddress: taker.address,
      lamports: lamports(2_000_000_000n),
      commitment: "confirmed",
    });

    mintA = await createMint(rpc, sendAndConfirm, payer, maker.address);
    mintB = await createMint(rpc, sendAndConfirm, payer, maker.address);

    // maker funded with mintA (will be deposited into vault)
    await createAtaAndMint(rpc, sendAndConfirm, payer, maker, mintA, maker.address, AMOUNT_A);
    // taker funded with mintB (will be sent to maker on take)
    await createAtaAndMint(rpc, sendAndConfirm, payer, maker, mintB, taker.address, AMOUNT_B);
  });

  it("make: initializes escrow and funds vault", async () => {
    const ix = await getMakeInstructionAsync({
      maker,
      mintA,
      mintB,
      seed,
      amountA: AMOUNT_A,
      amountB: AMOUNT_B,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    await send(rpc, sendAndConfirm, maker, [ix]);

    const [escrowPda] = await findEscrowPda({ maker: maker.address, seed });
    const account = await fetchEscrow(rpc, escrowPda);
    expect(account.data.seed).to.equal(seed);
    expect(account.data.maker).to.equal(maker.address);
    expect(account.data.mintA).to.equal(mintA);
    expect(account.data.mintB).to.equal(mintB);
    expect(account.data.amountA).to.equal(AMOUNT_A);
    expect(account.data.amountB).to.equal(AMOUNT_B);
  });

  it("take: taker swaps mintB for mintA, escrow closes", async () => {
    const ix = await getTakeInstructionAsync({
      taker,
      maker: maker.address,
      mintA,
      mintB,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      escrow: (await findEscrowPda({ maker: maker.address, seed }))[0],
    });
    await send(rpc, sendAndConfirm, taker, [ix]);

    const [escrowPda] = await findEscrowPda({ maker: maker.address, seed });
    const info = await rpc.getAccountInfo(escrowPda).send();
    expect(info.value).to.equal(null);
  });

  it("refund: maker reclaims vault (fresh escrow)", async () => {
    const refundSeed = seed + 1n;
    const makeIx = await getMakeInstructionAsync({
      maker,
      mintA,
      mintB,
      seed: refundSeed,
      amountA: AMOUNT_A,
      amountB: AMOUNT_B,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    // top up maker's mintA ATA so make has tokens to deposit
    await createAtaAndMint(rpc, sendAndConfirm, maker, maker, mintA, maker.address, AMOUNT_A);
    await send(rpc, sendAndConfirm, maker, [makeIx]);

    const refundIx = await getRefundInstructionAsync({
      maker,
      mintA,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      escrow: (await findEscrowPda({ maker: maker.address, seed: refundSeed }))[0],
    });
    await send(rpc, sendAndConfirm, maker, [refundIx]);

    const [escrowPda] = await findEscrowPda({ maker: maker.address, seed: refundSeed });
    const info = await rpc.getAccountInfo(escrowPda).send();
    expect(info.value).to.equal(null);
  });
});
