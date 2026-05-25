"use client";

import type { FC } from "react";

import { Label } from "@/components/ui/label";
import { truncateAddress } from "@/lib/escrow";
import { usePoolsQuery, type Pool } from "@/lib/amm";

type Props = {
  value: string;
  onChange: (pool: Pool | null) => void;
  id?: string;
  label?: string;
};

export const PoolCombobox: FC<Props> = ({ value, onChange, id, label }) => {
  const { data: pools = [], isLoading } = usePoolsQuery();

  return (
    <div className="space-y-1">
      {label && (
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const next = pools.find((p) => p.address === e.target.value) ?? null;
          onChange(next);
        }}
        disabled={isLoading || pools.length === 0}
        className="w-full border border-input bg-background px-3 py-2 text-sm font-mono !rounded-none disabled:opacity-50"
      >
        <option value="">
          {isLoading
            ? "loading pools…"
            : pools.length === 0
              ? "no pools found"
              : "select pool"}
        </option>
        {pools.map((p) => (
          <option key={p.address} value={p.address}>
            {truncateAddress(p.address)} · seed {p.data.seed.toString()} · {truncateAddress(p.data.mintX)} / {truncateAddress(p.data.mintY)}
          </option>
        ))}
      </select>
    </div>
  );
};
