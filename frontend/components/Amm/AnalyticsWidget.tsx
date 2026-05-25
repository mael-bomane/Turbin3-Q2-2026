"use client";

import type { FC } from "react";
import { useAnalyticsQuery } from "@/lib/amm";
import { useSolPrice } from "@/components/providers/SolanaProvider";

const LAMPORTS_PER_SOL_NUM = 1_000_000_000;

function fmtNum(n: bigint): string {
  return n.toLocaleString("en-US");
}

function fmtUsd(lamports: bigint, solPrice: number | null): string {
  if (solPrice === null) return "—";
  const sol = Number(lamports) / LAMPORTS_PER_SOL_NUM;
  const usd = sol * solPrice;
  return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtWsol(lamports: bigint): string {
  return (lamports / BigInt(LAMPORTS_PER_SOL_NUM)).toLocaleString("en-US");
}

export const AnalyticsWidget: FC = () => {
  const { data, isLoading } = useAnalyticsQuery();
  const { price: solPrice } = useSolPrice();

  if (isLoading) {
    return (
      <div className="border border-network p-3 text-xs text-muted-foreground">
        loading analytics…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="border border-network p-3 text-xs text-muted-foreground">
        analytics not initialized
      </div>
    );
  }

  const stats: Array<{ label: string; value: string }> = [
    { label: "tvl", value: fmtUsd(data.tvlWsol, solPrice ?? null) },
    { label: "volume (wsol)", value: fmtWsol(data.volumeWsol) },
    { label: "swaps", value: fmtNum(data.swaps) },
    { label: "pairs created", value: fmtNum(data.pairsCreated) },
    { label: "active pairs", value: fmtNum(data.activePairs) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      {stats.map((s) => (
        <div
          key={s.label}
          className="border border-network p-3 flex flex-col gap-1 font-mono text-center"
        >
          <span className="text-xs text-muted-foreground uppercase">{s.label}</span>
          <span className="text-sm">{s.value}</span>
        </div>
      ))}
    </div>
  );
};
