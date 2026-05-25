"use client";

import { useQuery } from "@tanstack/react-query";
import {
  address as toAddress,
  getBase58Decoder,
  type Address,
  type Instruction,
  type Rpc,
  type SolanaRpcApi,
  type TransactionSigner,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getSyncNativeInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  ANCHOR_AMM_PROGRAM_ADDRESS,
  CONFIG_DISCRIMINATOR,
  findAnalyticsPda,
  findConfigPda,
  findMintLpPda,
  getAnalyticsDecoder,
  getConfigDecoder,
  type Analytics,
  type Config,
} from "@trib3/anchor-amm-sdk";

import { useRpc } from "@/lib/escrow";

export type Pool = { address: Address; data: Config };
export type AnalyticsData = Analytics;

export const WSOL_MINT = toAddress("So11111111111111111111111111111111111111112");

export function isWsol(mint: Address | string | null | undefined): boolean {
  return !!mint && String(mint) === String(WSOL_MINT);
}

/**
 * Build instructions to ensure the signer's WSOL ATA exists and holds at least
 * `requiredAmount` lamports of wrapped SOL. Tops up only the deficit.
 */
export async function buildWsolTopUpInstructions(
  rpc: Rpc<SolanaRpcApi>,
  signer: TransactionSigner,
  requiredAmount: bigint,
): Promise<Instruction[]> {
  if (requiredAmount <= 0n) return [];
  const [ata] = await findAssociatedTokenPda({
    owner: signer.address,
    mint: WSOL_MINT,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  let currentBalance = 0n;
  let ataExists = false;
  try {
    const { value } = await rpc.getTokenAccountBalance(ata).send();
    currentBalance = BigInt(value.amount);
    ataExists = true;
  } catch {
    // ATA missing — keep ataExists false
  }

  const ixs: Instruction[] = [];
  if (!ataExists) {
    ixs.push(
      await getCreateAssociatedTokenIdempotentInstructionAsync({
        payer: signer as any,
        ata,
        owner: signer.address,
        mint: WSOL_MINT,
      }),
    );
  }
  if (currentBalance < requiredAmount) {
    const deficit = requiredAmount - currentBalance;
    ixs.push(
      getTransferSolInstruction({
        source: signer as any,
        destination: ata,
        amount: deficit,
      }),
    );
    ixs.push(getSyncNativeInstruction({ account: ata }));
  }
  return ixs;
}

export const ammPoolsQueryKey = (rpcUrl: string) =>
  ["amm-pools", rpcUrl] as const;

export const ammReservesQueryKey = (rpcUrl: string, config: Address) =>
  ["amm-reserves", rpcUrl, String(config)] as const;

export const ammLpSupplyQueryKey = (rpcUrl: string, config: Address) =>
  ["amm-lp-supply", rpcUrl, String(config)] as const;

export const ammAnalyticsQueryKey = (rpcUrl: string) =>
  ["amm-analytics", rpcUrl] as const;

async function getAccountUiAmount(
  rpc: Rpc<SolanaRpcApi>,
  account: Address,
): Promise<bigint> {
  try {
    const { value } = await rpc.getTokenAccountBalance(account).send();
    return BigInt(value.amount);
  } catch {
    return 0n;
  }
}

export async function fetchPools(rpc: Rpc<SolanaRpcApi>): Promise<Pool[]> {
  const discBase58 = getBase58Decoder().decode(CONFIG_DISCRIMINATOR);
  const res = await rpc
    .getProgramAccounts(ANCHOR_AMM_PROGRAM_ADDRESS, {
      encoding: "base64",
      filters: [
        {
          memcmp: {
            offset: BigInt(0),
            bytes: discBase58 as any,
            encoding: "base58",
          },
        },
      ],
    })
    .send();
  const decoder = getConfigDecoder();
  const items = (Array.isArray(res) ? res : (res as any).value) as Array<{
    pubkey: Address;
    account: { data: [string, string] };
  }>;
  return items.map(({ pubkey, account: acc }) => {
    const bytes = Uint8Array.from(Buffer.from(acc.data[0], "base64"));
    return { address: pubkey, data: decoder.decode(bytes) };
  });
}

export function usePoolsQuery() {
  const { rpc, rpcUrl } = useRpc();
  return useQuery({
    queryKey: ammPoolsQueryKey(rpcUrl),
    queryFn: () => fetchPools(rpc),
  });
}

export type PoolReserves = {
  reserveX: bigint;
  reserveY: bigint;
  vaultX: Address;
  vaultY: Address;
};

export async function deriveVaults(
  config: Address,
  mintX: Address,
  mintY: Address,
): Promise<{ vaultX: Address; vaultY: Address }> {
  const [vaultX] = await findAssociatedTokenPda({
    owner: config,
    mint: mintX,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [vaultY] = await findAssociatedTokenPda({
    owner: config,
    mint: mintY,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return { vaultX, vaultY };
}

export async function fetchPoolReserves(
  rpc: Rpc<SolanaRpcApi>,
  config: Address,
  mintX: Address,
  mintY: Address,
): Promise<PoolReserves> {
  const { vaultX, vaultY } = await deriveVaults(config, mintX, mintY);
  const [reserveX, reserveY] = await Promise.all([
    getAccountUiAmount(rpc, vaultX),
    getAccountUiAmount(rpc, vaultY),
  ]);
  return { reserveX, reserveY, vaultX, vaultY };
}

export function usePoolReservesQuery(pool: Pool | null) {
  const { rpc, rpcUrl } = useRpc();
  return useQuery({
    queryKey: pool
      ? ammReservesQueryKey(rpcUrl, pool.address)
      : ["amm-reserves", "noop"],
    enabled: !!pool,
    queryFn: () =>
      fetchPoolReserves(rpc, pool!.address, pool!.data.mintX, pool!.data.mintY),
  });
}

export async function fetchLpSupply(
  rpc: Rpc<SolanaRpcApi>,
  config: Address,
): Promise<bigint> {
  const [mintLp] = await findMintLpPda({ config });
  try {
    const { value } = await rpc.getTokenSupply(mintLp).send();
    return BigInt(value.amount);
  } catch {
    return 0n;
  }
}

export function useLpSupplyQuery(pool: Pool | null) {
  const { rpc, rpcUrl } = useRpc();
  return useQuery({
    queryKey: pool
      ? ammLpSupplyQueryKey(rpcUrl, pool.address)
      : ["amm-lp-supply", "noop"],
    enabled: !!pool,
    queryFn: () => fetchLpSupply(rpc, pool!.address),
  });
}

export function quoteSwap(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number,
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const feeNum = BigInt(10_000 - feeBps);
  const amountInAfterFee = (amountIn * feeNum) / 10_000n;
  return (amountInAfterFee * reserveOut) / (reserveIn + amountInAfterFee);
}

export function quoteLpFromDeposit(
  amountX: bigint,
  amountY: bigint,
  reserveX: bigint,
  reserveY: bigint,
  lpSupply: bigint,
): bigint {
  if (lpSupply === 0n) {
    let prod = amountX * amountY;
    if (prod <= 0n) return 0n;
    let lo = 0n;
    let hi = prod;
    while (lo < hi) {
      const mid = (lo + hi + 1n) / 2n;
      if (mid * mid <= prod) lo = mid;
      else hi = mid - 1n;
    }
    return lo;
  }
  if (reserveX <= 0n || reserveY <= 0n) return 0n;
  const lpX = (amountX * lpSupply) / reserveX;
  const lpY = (amountY * lpSupply) / reserveY;
  return lpX < lpY ? lpX : lpY;
}

export async function fetchAnalyticsData(
  rpc: Rpc<SolanaRpcApi>,
): Promise<AnalyticsData | null> {
  const [pda] = await findAnalyticsPda();
  try {
    const { value } = await rpc
      .getAccountInfo(pda, { encoding: "base64" })
      .send();
    if (!value) return null;
    const data = (value as any).data;
    const b64 = Array.isArray(data) ? data[0] : data;
    const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
    return getAnalyticsDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function useAnalyticsQuery() {
  const { rpc, rpcUrl } = useRpc();
  return useQuery({
    queryKey: ammAnalyticsQueryKey(rpcUrl),
    queryFn: () => fetchAnalyticsData(rpc),
    retry: 1,
    staleTime: 15_000,
  });
}

export { findConfigPda, findMintLpPda, findAnalyticsPda, ANCHOR_AMM_PROGRAM_ADDRESS };
