"use client";

import { useMemo } from "react";
import {
  createSolanaRpc,
  type Address,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";
import { useNetwork } from "@/components/providers/NetworkProvider";

export type SolanaChain = `solana:${string}`;

export const WSOL_MINT =
  "So11111111111111111111111111111111111111112" as Address;

export function getChainFromRpc(rpcUrl: string): SolanaChain {
  if (rpcUrl.includes("devnet")) return "solana:devnet";
  if (rpcUrl.includes("testnet")) return "solana:testnet";
  if (rpcUrl.includes("localhost") || rpcUrl.includes("127.0.0.1"))
    return "solana:localnet";
  return "solana:mainnet";
}

export function useRpc(): {
  rpc: Rpc<SolanaRpcApi>;
  rpcUrl: string;
  chain: SolanaChain;
} {
  const { rpc: rpcUrl } = useNetwork();
  return useMemo(
    () => ({
      rpc: createSolanaRpc(rpcUrl),
      rpcUrl,
      chain: getChainFromRpc(rpcUrl),
    }),
    [rpcUrl],
  );
}

export function toBaseUnits(human: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = human.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole + fracPadded);
}

export function fromBaseUnits(base: bigint, decimals: number): string {
  const s = base.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export function truncateAddress(addr: string | Address): string {
  const s = String(addr);
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function explorerUrl(
  address: string | Address,
  chain: SolanaChain,
  kind: "address" | "tx" = "address",
): string {
  const base = `https://explorer.solana.com/${kind}/${String(address)}`;
  if (chain === "solana:mainnet") return base;
  if (chain === "solana:devnet") return `${base}?cluster=devnet`;
  if (chain === "solana:testnet") return `${base}?cluster=testnet`;
  return `${base}?cluster=custom&customUrl=http://localhost:8899`;
}

export function useExplorer(): (
  address: string | Address,
  kind?: "address" | "tx",
) => string {
  const { chain } = useRpc();
  return (address, kind = "address") => explorerUrl(address, chain, kind);
}
