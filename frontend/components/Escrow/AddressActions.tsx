"use client";

import { useState, type FC } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { Address } from "@solana/kit";

import { cn } from "@/lib/utils";

type Props = {
  address: Address | string;
  className?: string;
  iconSize?: number;
};

export const AddressActions: FC<Props> = ({
  address,
  className,
  iconSize = 12,
}) => {
  const [copied, setCopied] = useState(false);
  const addr = String(address);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      toast.success("address copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("copy failed");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="copy address"
      title="copy address"
      className={cn(
        "inline-flex items-center align-middle text-muted-foreground hover:text-network transition-colors cursor-pointer",
        className,
      )}
    >
      {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
    </button>
  );
};
