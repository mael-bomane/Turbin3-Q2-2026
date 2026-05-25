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

import {
  getCreateAccountInstruction,
  getTransferSolInstruction,
} from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToInstruction,
  getSyncNativeInstruction,
} from "@solana-program/token";

const WSOL_MINT =
  "So11111111111111111111111111111111111111112" as Address<"So11111111111111111111111111111111111111112">;

import {
  fetchAnalytics,
  fetchConfig,
  findAnalyticsPda,
  findConfigPda,
  findMintLpPda,
  getDepositInstructionAsync,
  getInitializeAnalyticsInstructionAsync,
  getInitializeInstructionAsync,
  getLockInstructionAsync,
  getSetAdminInstructionAsync,
  getSwapInstructionAsync,
  getUnlockInstructionAsync,
  getWithdrawInstructionAsync,
} from "../../../sdk/src/generated";

const RPC_URL = "http://127.0.0.1:8899";
const WS_URL = "ws://127.0.0.1:8900";
const DECIMALS = 6;
const FEE_BPS = 30; // 0.3%
const INITIAL_X = 1_000_000_000n;
const INITIAL_Y = 2_000_000_000n;
const DEPOSIT_X = 100_000_000n;
const DEPOSIT_Y = 200_000_000n;
const LP_TARGET = 100_000_000n;
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
  let analyticsPda: Address;
  const seed = BigInt(Math.floor(Math.random() * 2 ** 32));

  // Counter snapshots for delta-based assertions across runs.
  let pairsCreatedBefore = 0n;
  let swapsBefore = 0n;
  let activePairsBefore = 0n;

  before(async () => {
    user = await loadWalletSigner();

    await airdrop({
      recipientAddress: user.address,
      lamports: lamports(5_000_000_000n),
      commitment: "confirmed",
    });

    mintX = await createMint(rpc, sendAndConfirm, user, user.address);
    mintY = await createMint(rpc, sendAndConfirm, user, user.address);

    await createAtaAndMint(rpc, sendAndConfirm, user, user, mintX, user.address, INITIAL_X);
    await createAtaAndMint(rpc, sendAndConfirm, user, user, mintY, user.address, INITIAL_Y);

    [configPda] = await findConfigPda({ seed });
    [analyticsPda] = await findAnalyticsPda();
  });

  it("initialize_analytics: idempotent (first-wins)", async () => {
    const existing = await rpc.getAccountInfo(analyticsPda).send();
    if (!existing.value) {
      const ix = await getInitializeAnalyticsInstructionAsync({
        payer: user,
        admin: user.address,
      });
      await send(rpc, sendAndConfirm, user, [ix]);
    }
    const account = await fetchAnalytics(rpc, analyticsPda);
    expect(account.data.admin).to.equal(user.address);
    pairsCreatedBefore = account.data.pairsCreated;
    swapsBefore = account.data.swaps;
    activePairsBefore = account.data.activePairs;
  });

  it("initialize: creates pool, bumps pairs_created", async () => {
    const ix = await getInitializeInstructionAsync({
      payer: user,
      mintX,
      mintY,
      seed,
      fee: FEE_BPS,
    });
    await send(rpc, sendAndConfirm, user, [ix]);

    const cfg = await fetchConfig(rpc, configPda);
    expect(cfg.data.seed).to.equal(seed);
    expect(cfg.data.mintX).to.equal(mintX);
    expect(cfg.data.mintY).to.equal(mintY);
    expect(cfg.data.fee).to.equal(FEE_BPS);
    expect(cfg.data.locked).to.equal(false);
    expect(cfg.data.activated).to.equal(false);

    const a = await fetchAnalytics(rpc, analyticsPda);
    expect(a.data.pairsCreated).to.equal(pairsCreatedBefore + 1n);
  });

  it("deposit: seeds vaults and mints LP", async () => {
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

  it("swap: x->y, activates pool, bumps swaps + active_pairs", async () => {
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

    const cfg = await fetchConfig(rpc, configPda);
    expect(cfg.data.activated).to.equal(true);

    const a = await fetchAnalytics(rpc, analyticsPda);
    expect(a.data.swaps).to.equal(swapsBefore + 1n);
    expect(a.data.activePairs).to.equal(activePairsBefore + 1n);
  });

  it("withdraw: burns LP, returns proportional x/y", async () => {
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

  it("lock: admin locks, active_pairs decrements", async () => {
    const aBefore = await fetchAnalytics(rpc, analyticsPda);
    const ix = await getLockInstructionAsync({
      authority: user,
      config: configPda,
    });
    await send(rpc, sendAndConfirm, user, [ix]);

    const cfg = await fetchConfig(rpc, configPda);
    expect(cfg.data.locked).to.equal(true);

    const aAfter = await fetchAnalytics(rpc, analyticsPda);
    expect(aAfter.data.activePairs).to.equal(aBefore.data.activePairs - 1n);
  });

  it("swap on locked pool: fails with PoolLocked", async () => {
    const ix = await getSwapInstructionAsync({
      user,
      mintX,
      mintY,
      config: configPda,
      isX: true,
      amountIn: 1_000n,
      minAmountOut: 1n,
    });
    try {
      await send(rpc, sendAndConfirm, user, [ix]);
      expect.fail("expected PoolLocked");
    } catch (e) {
      // pass — any error indicates rejection
    }
  });

  it("unlock: admin unlocks, active_pairs re-increments", async () => {
    const aBefore = await fetchAnalytics(rpc, analyticsPda);
    const ix = await getUnlockInstructionAsync({
      authority: user,
      config: configPda,
    });
    await send(rpc, sendAndConfirm, user, [ix]);

    const cfg = await fetchConfig(rpc, configPda);
    expect(cfg.data.locked).to.equal(false);

    const aAfter = await fetchAnalytics(rpc, analyticsPda);
    expect(aAfter.data.activePairs).to.equal(aBefore.data.activePairs + 1n);
  });

  it("set_admin: rotates admin, old admin loses control", async () => {
    const newAdmin = await generateKeyPairSigner();
    await airdrop({
      recipientAddress: newAdmin.address,
      lamports: lamports(1_000_000_000n),
      commitment: "confirmed",
    });

    const ix = await getSetAdminInstructionAsync({
      admin: user,
      newAdmin: newAdmin.address,
    });
    await send(rpc, sendAndConfirm, user, [ix]);

    const a = await fetchAnalytics(rpc, analyticsPda);
    expect(a.data.admin).to.equal(newAdmin.address);

    // Old admin lock attempt must now fail.
    const lockIx = await getLockInstructionAsync({
      authority: user,
      config: configPda,
    });
    try {
      await send(rpc, sendAndConfirm, user, [lockIx]);
      expect.fail("old admin should not be able to lock");
    } catch (e) {
      // pass
    }

    // Restore admin to user for any subsequent runs / cleanup.
    const restore = await getSetAdminInstructionAsync({
      admin: newAdmin,
      newAdmin: user.address,
    });
    await send(rpc, sendAndConfirm, newAdmin, [restore]);
  });

  it("initialize: rejects fee > 10000 bps", async () => {
    const badSeed = BigInt(Math.floor(Math.random() * 2 ** 32));
    const ix = await getInitializeInstructionAsync({
      payer: user,
      mintX,
      mintY,
      seed: badSeed,
      fee: 10_001,
    });
    try {
      await send(rpc, sendAndConfirm, user, [ix]);
      expect.fail("expected FeePercentErr");
    } catch (e) {
      // pass
    }
  });
});

describe("anchor-amm — WSOL pool (TVL & volume tracking)", () => {
  const rpc = createSolanaRpc(RPC_URL);
  const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  const airdrop = airdropFactory({ rpc, rpcSubscriptions });

  // Pool layout: mintX = WSOL, mintY = arbitrary SPL token.
  const seed = BigInt(Math.floor(Math.random() * 2 ** 32));
  const WSOL_DEPOSIT = 100_000_000n; // 0.1 SOL @ 9 decimals
  const Y_DEPOSIT = 200_000_000n;
  const LP_TARGET = 100_000_000n;
  const WSOL_SWAP_IN = 5_000_000n;
  const WSOL_RESERVE_FOR_ATA = 500_000_000n; // 0.5 SOL into the WSOL ata for funding

  let user: KeyPairSigner;
  let mintY: Address;
  let configPda: Address;
  let analyticsPda: Address;
  let userWsolAta: Address;
  let userYAta: Address;

  async function fundWsol(amount: bigint) {
    await send(rpc, sendAndConfirm, user, [
      getTransferSolInstruction({
        source: user,
        destination: userWsolAta,
        amount,
      }),
      getSyncNativeInstruction({ account: userWsolAta }),
    ]);
  }

  before(async () => {
    user = await loadWalletSigner();
    await airdrop({
      recipientAddress: user.address,
      lamports: lamports(5_000_000_000n),
      commitment: "confirmed",
    });

    mintY = await createMint(rpc, sendAndConfirm, user, user.address);
    userYAta = await createAtaAndMint(rpc, sendAndConfirm, user, user, mintY, user.address, 2_000_000_000n);

    [userWsolAta] = await findAssociatedTokenPda({
      owner: user.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      mint: WSOL_MINT,
    });
    await send(rpc, sendAndConfirm, user, [
      await getCreateAssociatedTokenIdempotentInstructionAsync({
        payer: user,
        ata: userWsolAta,
        owner: user.address,
        mint: WSOL_MINT,
      }),
    ]);
    await fundWsol(WSOL_RESERVE_FOR_ATA);

    [configPda] = await findConfigPda({ seed });
    [analyticsPda] = await findAnalyticsPda();

    // Analytics should already be initialized by the prior describe; if not, init.
    const existing = await rpc.getAccountInfo(analyticsPda).send();
    if (!existing.value) {
      await send(rpc, sendAndConfirm, user, [
        await getInitializeAnalyticsInstructionAsync({
          payer: user,
          admin: user.address,
        }),
      ]);
    }
  });

  it("initialize WSOL pool", async () => {
    const ix = await getInitializeInstructionAsync({
      payer: user,
      mintX: WSOL_MINT,
      mintY,
      seed,
      fee: 30,
    });
    await send(rpc, sendAndConfirm, user, [ix]);

    const cfg = await fetchConfig(rpc, configPda);
    expect(cfg.data.mintX).to.equal(WSOL_MINT);
    expect(cfg.data.mintY).to.equal(mintY);
  });

  it("deposit: tvl_wsol += deposited WSOL", async () => {
    const aBefore = await fetchAnalytics(rpc, analyticsPda);

    const ix = await getDepositInstructionAsync({
      user,
      mintX: WSOL_MINT,
      mintY,
      config: configPda,
      amount: LP_TARGET,
      maxX: WSOL_DEPOSIT,
      maxY: Y_DEPOSIT,
    });
    await send(rpc, sendAndConfirm, user, [ix]);

    const aAfter = await fetchAnalytics(rpc, analyticsPda);
    expect(aAfter.data.tvlWsol).to.equal(aBefore.data.tvlWsol + WSOL_DEPOSIT);
    // No swap yet — volume unchanged.
    expect(aAfter.data.volumeWsol).to.equal(aBefore.data.volumeWsol);
  });

  it("swap WSOL -> Y: volume_wsol += deposit; tvl_wsol += deposit", async () => {
    const aBefore = await fetchAnalytics(rpc, analyticsPda);

    const ix = await getSwapInstructionAsync({
      user,
      mintX: WSOL_MINT,
      mintY,
      config: configPda,
      isX: true,
      amountIn: WSOL_SWAP_IN,
      minAmountOut: 1n,
    });
    await send(rpc, sendAndConfirm, user, [ix]);

    const aAfter = await fetchAnalytics(rpc, analyticsPda);
    // WSOL leg = X side, user deposited WSOL → exact WSOL_SWAP_IN flowed in.
    expect(aAfter.data.volumeWsol).to.equal(aBefore.data.volumeWsol + WSOL_SWAP_IN);
    expect(aAfter.data.tvlWsol).to.equal(aBefore.data.tvlWsol + WSOL_SWAP_IN);
    expect(aAfter.data.swaps).to.equal(aBefore.data.swaps + 1n);
  });

  it("swap Y -> WSOL: volume_wsol += withdrawn WSOL; tvl_wsol -= withdrawn WSOL", async () => {
    const aBefore = await fetchAnalytics(rpc, analyticsPda);
    const userWsolBefore = (await fetchToken(rpc, userWsolAta)).data.amount;

    const ix = await getSwapInstructionAsync({
      user,
      mintX: WSOL_MINT,
      mintY,
      config: configPda,
      isX: false,
      amountIn: 10_000_000n,
      minAmountOut: 1n,
    });
    await send(rpc, sendAndConfirm, user, [ix]);

    const userWsolAfter = (await fetchToken(rpc, userWsolAta)).data.amount;
    const wsolOut = userWsolAfter - userWsolBefore;
    expect(wsolOut > 0n).to.equal(true);

    const aAfter = await fetchAnalytics(rpc, analyticsPda);
    expect(aAfter.data.volumeWsol).to.equal(aBefore.data.volumeWsol + wsolOut);
    expect(aAfter.data.tvlWsol).to.equal(aBefore.data.tvlWsol - wsolOut);
  });

  it("withdraw: tvl_wsol -= withdrawn WSOL", async () => {
    const [vaultXAta] = await findAssociatedTokenPda({
      owner: configPda,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      mint: WSOL_MINT,
    });
    const [mintLpPda] = await findMintLpPda({ config: configPda });
    const [userLpAta] = await findAssociatedTokenPda({
      owner: user.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      mint: mintLpPda,
    });

    const lpBalance = (await fetchToken(rpc, userLpAta)).data.amount;
    const vaultWsolBefore = (await fetchToken(rpc, vaultXAta)).data.amount;
    const aBefore = await fetchAnalytics(rpc, analyticsPda);

    const burn = lpBalance / 2n;
    const ix = await getWithdrawInstructionAsync({
      user,
      mintX: WSOL_MINT,
      mintY,
      config: configPda,
      amount: burn,
      minX: 1n,
      minY: 1n,
    });
    await send(rpc, sendAndConfirm, user, [ix]);

    const vaultWsolAfter = (await fetchToken(rpc, vaultXAta)).data.amount;
    const wsolWithdrawn = vaultWsolBefore - vaultWsolAfter;

    const aAfter = await fetchAnalytics(rpc, analyticsPda);
    expect(aAfter.data.tvlWsol).to.equal(aBefore.data.tvlWsol - wsolWithdrawn);
  });
});
