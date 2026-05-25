"use client";

import type { FC } from "react";
import type { Address } from "@solana/kit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTokenMetadata } from "@/lib/tokenMetadata";
import { truncateAddress, useExplorer } from "@/lib/escrow";
import { cn } from "@/lib/utils";
import { AddressActions } from "./AddressActions";

type Props = {
  mint: Address | string;
  amount?: string;
  className?: string;
};

export const TokenChip: FC<Props> = ({ mint, amount, className }) => {
  const meta = useTokenMetadata(mint);
  const explorer = useExplorer();
  const label = meta.symbol ?? truncateAddress(String(mint));
  const initial = (meta.symbol ?? String(mint)).slice(0, 1).toUpperCase();

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      title={meta.name ?? String(mint)}
    >
      <Avatar className="h-5 w-5">
        {meta.icon ? <AvatarImage src={meta.icon} alt={label} /> : null}
        <AvatarFallback className="text-[10px] font-mono">
          {initial}
        </AvatarFallback>
      </Avatar>
      {amount !== undefined && <span>{amount}</span>}
      <a
        href={explorer(String(mint))}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "hover:underline underline-offset-2 hover:text-network transition-colors",
          meta.symbol ? "" : "font-mono text-xs",
        )}
      >
        {label}
      </a>
      <AddressActions address={mint} />
    </span>
  );
};
