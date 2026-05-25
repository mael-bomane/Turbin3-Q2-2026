"use client";

import { formatNumber } from "@/lib/utils";
import { useMemo, type FC } from "react";
import { useSolPrice } from "@/components/providers/SolanaProvider";

type Props = {
  amount?: number;
};

export const SolanaUsd: FC<Props> = ({ amount = 1 }) => {
  const { price, loading } = useSolPrice();

  const value = useMemo(() => {
    if (!price) return null;
    return formatNumber(amount * price);
  }, [amount, price, loading]);

  return value;
};
