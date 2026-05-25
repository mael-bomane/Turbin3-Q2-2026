"use client";

import type { FC } from "react";
import type { Address } from "@solana/kit";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTokenMetadata } from "@/lib/tokenMetadata";
import { cn } from "@/lib/utils";

const SingleIcon: FC<{
  mint: Address;
  size: number;
  z: number;
  offset: number;
}> = ({ mint, size, z, offset }) => {
  const meta = useTokenMetadata(mint);
  const label = meta.symbol ?? String(mint);
  const initial = (meta.symbol ?? String(mint)).slice(0, 1).toUpperCase();
  return (
    <div
      className="ring-2 ring-background rounded-full overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        marginLeft: offset,
        zIndex: z,
      }}
      title={label}
    >
      <Avatar className="h-full w-full">
        {meta.icon ? <AvatarImage src={meta.icon} alt={label} /> : null}
        <AvatarFallback className="text-[10px] font-mono">
          {initial}
        </AvatarFallback>
      </Avatar>
    </div>
  );
};

type Props = {
  mintX: Address;
  mintY: Address;
  size?: number;
  overlap?: number;
  className?: string;
};

export const StackedTokenIcons: FC<Props> = ({
  mintX,
  mintY,
  size = 28,
  overlap = 10,
  className,
}) => (
  <div className={cn("flex items-center", className)}>
    <SingleIcon mint={mintX} size={size} z={2} offset={0} />
    <SingleIcon mint={mintY} size={size} z={1} offset={-overlap} />
  </div>
);
