"use client";

export const dynamic = "force-dynamic"

import { useSolPrice } from "./providers/SolanaProvider";
import { useValidators } from "./providers/ValidatorsProvider";
import { formatNumber } from "@/lib/utils";
import type { FC } from "react";

type Props = {
  factor?: number;
  usd?: boolean;
  decimals?: number;
};

export const SolanaStake: FC<Props> = ({
  factor = 1,
  usd = false,
  decimals = 2,
}) => {
  const { price } = useSolPrice();
  const { activeStake } = useValidators();

  // Raw lamports → SOL → millions
  const solAmount = Number(activeStake) / 1e9 / 1_000_000;

  if (!usd) {
    return <>{(solAmount * factor).toFixed(decimals)}</>;
  }

  return <>$ {formatNumber(solAmount * factor * price)} B</>;
};
