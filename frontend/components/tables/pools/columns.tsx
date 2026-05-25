"use client";

import type { ColumnDef, RowData } from "@tanstack/react-table";
import type { FC } from "react";

import { Button } from "@/components/ui/button";
import { fromBaseUnits, truncateAddress } from "@/lib/escrow";
import { useMintDecimals } from "@/lib/userTokens";
import { useTokenMetadata } from "@/lib/tokenMetadata";
import {
  useLpSupplyQuery,
  usePoolReservesQuery,
  type Pool,
} from "@/lib/amm";
import { StackedTokenIcons } from "@/components/shared/StackedTokenIcons";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    selectedPool: string | null;
    onDepositClick?: (pool: Pool) => void;
  }
}

const PairCell: FC<{ pool: Pool }> = ({ pool }) => {
  const metaX = useTokenMetadata(pool.data.mintX);
  const metaY = useTokenMetadata(pool.data.mintY);
  const symX = metaX.symbol ?? truncateAddress(pool.data.mintX);
  const symY = metaY.symbol ?? truncateAddress(pool.data.mintY);
  return (
    <div className="flex items-center gap-3 min-w-0">
      <StackedTokenIcons mintX={pool.data.mintX} mintY={pool.data.mintY} size={28} />
      <div className="flex flex-col min-w-0 leading-tight text-left">
        <span className="text-sm font-medium truncate">
          {symX} / {symY}
        </span>
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase truncate font-mono">
          {truncateAddress(pool.address)}
        </span>
      </div>
    </div>
  );
};

const ReservesCell: FC<{ pool: Pool }> = ({ pool }) => {
  const reserves = usePoolReservesQuery(pool);
  const decX = useMintDecimals(pool.data.mintX);
  const decY = useMintDecimals(pool.data.mintY);
  if (!reserves.data) {
    return <span className="text-xs text-muted-foreground">…</span>;
  }
  const fmt = (amt: bigint, d: number | null | undefined) =>
    d === null || d === undefined ? "…" : fromBaseUnits(amt, d);
  return (
    <div className="flex flex-col items-end text-xs font-mono leading-tight">
      <span>{fmt(reserves.data.reserveX, decX.data)}</span>
      <span className="text-muted-foreground">
        {fmt(reserves.data.reserveY, decY.data)}
      </span>
    </div>
  );
};

const LpSupplyCell: FC<{ pool: Pool }> = ({ pool }) => {
  const lp = useLpSupplyQuery(pool);
  if (lp.data === undefined) {
    return <span className="text-xs text-muted-foreground">…</span>;
  }
  return (
    <span className="text-xs font-mono">{fromBaseUnits(lp.data, 6)}</span>
  );
};

export const columns: ColumnDef<Pool>[] = [
  {
    id: "pair",
    header: () => <div className="pl-4 text-left">pool</div>,
    cell: ({ row }) => (
      <div className="pl-4">
        <PairCell pool={row.original} />
      </div>
    ),
    size: 240,
  },
  {
    id: "seed",
    header: "seed",
    accessorFn: (row) => row.data.seed,
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.data.seed.toString()}
      </span>
    ),
    size: 80,
  },
  {
    id: "fee",
    header: "fee",
    accessorFn: (row) => row.data.fee,
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {(row.original.data.fee / 100).toFixed(2)}%
      </span>
    ),
    size: 70,
  },
  {
    id: "reserves",
    header: "reserves",
    cell: ({ row }) => <ReservesCell pool={row.original} />,
    size: 140,
  },
  {
    id: "lpSupply",
    header: "lp supply",
    cell: ({ row }) => <LpSupplyCell pool={row.original} />,
    size: 110,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row, table }) => (
      <div className="flex justify-end pr-2">
        <Button
          size="sm"
          variant="network"
          onClick={(e) => {
            e.stopPropagation();
            table.options.meta?.onDepositClick?.(row.original);
          }}
          className="hover:text-white !rounded-none h-7 px-3 text-xs"
        >
          deposit
        </Button>
      </div>
    ),
    size: 100,
  },
];
