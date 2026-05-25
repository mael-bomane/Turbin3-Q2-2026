"use client";

import {
  createContext,
  useContext,
  useMemo,
  type FC,
  type ReactNode,
} from "react";
import type { Address } from "@solana/kit";

import {
  fetchPools,
  useAnalyticsQuery,
  usePoolsQuery,
  type AnalyticsData,
  type Pool,
} from "@/lib/amm";
import { useWallet } from "@/components/providers/WalletProvider";

export type ProgramContextValue = {
  pools: Pool[];
  mints: Address[];
  isLoading: boolean;
  findPool: (mintX: Address | string, mintY: Address | string) => Pool[];
  analytics: AnalyticsData | null;
  isAdmin: boolean;
};

const ProgramContext = createContext<ProgramContextValue | null>(null);

export const ProgramProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { data: pools = [], isLoading } = usePoolsQuery();
  const { data: analytics = null } = useAnalyticsQuery();
  const { account } = useWallet();

  const value = useMemo<ProgramContextValue>(() => {
    const mintSet = new Map<string, Address>();
    for (const p of pools) {
      mintSet.set(String(p.data.mintX), p.data.mintX);
      mintSet.set(String(p.data.mintY), p.data.mintY);
    }
    const walletAddr = account?.address ?? null;
    const isAdmin =
      !!analytics && !!walletAddr && String(analytics.admin) === String(walletAddr);
    return {
      pools,
      mints: Array.from(mintSet.values()),
      isLoading,
      findPool: (mintX, mintY) =>
        pools.filter(
          (p) =>
            String(p.data.mintX) === String(mintX) &&
            String(p.data.mintY) === String(mintY),
        ),
      analytics,
      isAdmin,
    };
  }, [pools, isLoading, analytics, account?.address]);

  return (
    <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>
  );
};

export function useProgram(): ProgramContextValue {
  const ctx = useContext(ProgramContext);
  if (!ctx) throw new Error("useProgram must be used within ProgramProvider");
  return ctx;
}

export { fetchPools };
