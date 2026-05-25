"use client";

import { useMemo, useState, type FC, type FormEvent } from "react";
import { ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase58Decoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
  type TransactionSendingSigner,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getSwapInstructionAsync } from "@trib3/anchor-amm-sdk";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRpc, toBaseUnits, fromBaseUnits } from "@/lib/escrow";
import { useMintDecimals } from "@/lib/userTokens";
import { TokenPairForm } from "@/components/shared/TokenPairForm";
import { useProgram } from "@/components/providers/Program";
import { PoolTokenCombobox } from "./PoolTokenCombobox";
import {
  ammAnalyticsQueryKey,
  ammPoolsQueryKey,
  ammReservesQueryKey,
  buildWsolTopUpInstructions,
  isWsol,
  quoteSwap,
  usePoolReservesQuery,
  WSOL_MINT,
  type AnalyticsData,
  type Pool,
} from "@/lib/amm";

type Props = { signer: TransactionSendingSigner | null };

export const SwapForm: FC<Props> = ({ signer }) => {
  const { rpc, rpcUrl } = useRpc();
  const queryClient = useQueryClient();
  const { findPool } = useProgram();

  const [mintIn, setMintIn] = useState(String(WSOL_MINT));
  const [mintOut, setMintOut] = useState("");
  const [amountIn, setAmountIn] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);

  const { pool, isXIn } = useMemo<{ pool: Pool | null; isXIn: boolean }>(() => {
    if (!mintIn || !mintOut) return { pool: null, isXIn: true };
    const forward = findPool(mintIn, mintOut)[0];
    if (forward) return { pool: forward, isXIn: true };
    const reverse = findPool(mintOut, mintIn)[0];
    if (reverse) return { pool: reverse, isXIn: false };
    return { pool: null, isXIn: true };
  }, [mintIn, mintOut, findPool]);

  const reserves = usePoolReservesQuery(pool);
  const decIn = useMintDecimals(mintIn || null);
  const decOut = useMintDecimals(mintOut || null);

  const reserveIn = reserves.data
    ? isXIn
      ? reserves.data.reserveX
      : reserves.data.reserveY
    : 0n;
  const reserveOut = reserves.data
    ? isXIn
      ? reserves.data.reserveY
      : reserves.data.reserveX
    : 0n;

  const quote = useMemo(() => {
    if (!pool || decIn.data === null || decIn.data === undefined || amountIn === "")
      return null;
    const base = toBaseUnits(amountIn, decIn.data);
    return quoteSwap(base, reserveIn, reserveOut, pool.data.fee);
  }, [pool, decIn.data, amountIn, reserveIn, reserveOut]);

  const minOut = useMemo(() => {
    if (quote === null) return null;
    return (quote * BigInt(10_000 - slippageBps)) / 10_000n;
  }, [quote, slippageBps]);

  const expectedOutDisplay =
    quote === null || decOut.data === null || decOut.data === undefined
      ? ""
      : fromBaseUnits(quote, decOut.data);

  const handleFlip = () => {
    setMintIn(mintOut);
    setMintOut(mintIn);
  };

  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!signer) throw new Error("connect wallet first");
      if (!pool) throw new Error("no pool for this pair");
      if (decIn.data === null || decIn.data === undefined)
        throw new Error("loading decimals…");
      if (quote === null || minOut === null) throw new Error("invalid amount");

      const amountInBase = toBaseUnits(amountIn, decIn.data);
      const wrapIxs = isWsol(mintIn)
        ? await buildWsolTopUpInstructions(rpc, signer, amountInBase)
        : [];

      const ix = await getSwapInstructionAsync({
        user: signer,
        mintX: pool.data.mintX,
        mintY: pool.data.mintY,
        config: pool.address,
        isX: isXIn,
        amountIn: amountInBase,
        minAmountOut: minOut,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });

      const { value: latest } = await rpc.getLatestBlockhash().send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(signer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
        (m) => appendTransactionMessageInstructions([...wrapIxs, ix], m),
      );
      const sigBytes = await signAndSendTransactionMessageWithSigners(message);
      return getBase58Decoder().decode(sigBytes);
    },
    onMutate: async () => {
      if (!pool || quote === null || decIn.data === null || decIn.data === undefined)
        return { previous: null as any };
      const reservesKey = ammReservesQueryKey(rpcUrl, pool.address);
      const analyticsKey = ammAnalyticsQueryKey(rpcUrl);
      const poolsKey = ammPoolsQueryKey(rpcUrl);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: reservesKey }),
        queryClient.cancelQueries({ queryKey: analyticsKey }),
        queryClient.cancelQueries({ queryKey: poolsKey }),
      ]);
      const previous = queryClient.getQueryData<typeof reserves.data>(reservesKey);
      const prevAnalytics =
        queryClient.getQueryData<AnalyticsData | null>(analyticsKey);
      const prevPools = queryClient.getQueryData<Pool[]>(poolsKey);

      const amountInBase = toBaseUnits(amountIn, decIn.data);

      // Reserves optimistic.
      if (previous) {
        queryClient.setQueryData(reservesKey, {
          ...previous,
          reserveX: isXIn
            ? previous.reserveX + amountInBase
            : previous.reserveX - quote,
          reserveY: isXIn
            ? previous.reserveY - quote
            : previous.reserveY + amountInBase,
        });
      }

      // Analytics optimistic: swaps++, optional WSOL tvl/volume delta,
      // active_pairs++ on first swap.
      if (prevAnalytics) {
        const wsolIsX = isWsol(pool.data.mintX);
        const wsolIsY = isWsol(pool.data.mintY);
        let tvlDelta = 0n;
        let wsolFlow = 0n;
        if (wsolIsX) {
          if (isXIn) {
            tvlDelta = amountInBase;
            wsolFlow = amountInBase;
          } else {
            tvlDelta = -quote;
            wsolFlow = quote;
          }
        } else if (wsolIsY) {
          if (isXIn) {
            tvlDelta = -quote;
            wsolFlow = quote;
          } else {
            tvlDelta = amountInBase;
            wsolFlow = amountInBase;
          }
        }
        const next: AnalyticsData = {
          ...prevAnalytics,
          swaps: prevAnalytics.swaps + 1n,
          tvlWsol: prevAnalytics.tvlWsol + tvlDelta,
          volumeWsol: prevAnalytics.volumeWsol + wsolFlow,
          activePairs: pool.data.activated
            ? prevAnalytics.activePairs
            : prevAnalytics.activePairs + 1n,
        };
        queryClient.setQueryData<AnalyticsData>(analyticsKey, next);
      }

      // Flip pool.activated optimistically on first swap.
      if (prevPools && !pool.data.activated) {
        queryClient.setQueryData<Pool[]>(
          poolsKey,
          prevPools.map((p) =>
            p.address === pool.address
              ? { ...p, data: { ...p.data, activated: true } }
              : p,
          ),
        );
      }

      return { previous, prevAnalytics, prevPools, reservesKey, analyticsKey, poolsKey };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.reservesKey && ctx.previous !== undefined)
        queryClient.setQueryData(ctx.reservesKey, ctx.previous);
      if (ctx?.analyticsKey && ctx.prevAnalytics !== undefined)
        queryClient.setQueryData(ctx.analyticsKey, ctx.prevAnalytics);
      if (ctx?.poolsKey && ctx.prevPools !== undefined)
        queryClient.setQueryData(ctx.poolsKey, ctx.prevPools);
      console.error(err);
      toast.error(err instanceof Error ? err.message : "swap failed");
    },
    onSuccess: (sig) => {
      toast.success(`swap ok — ${sig.slice(0, 8)}…`);
      setAmountIn("");
    },
    onSettled: () => {
      if (pool) {
        queryClient.invalidateQueries({
          queryKey: ammReservesQueryKey(rpcUrl, pool.address),
        });
      }
      queryClient.invalidateQueries({ queryKey: ammAnalyticsQueryKey(rpcUrl) });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    swapMutation.mutate();
  };

  const pairValid = !!mintIn && !!mintOut && !!pool;
  const poolLocked = !!pool && pool.data.locked;
  const canSubmit =
    !!signer && pairValid && !poolLocked && amountIn !== "" && quote !== null && quote > 0n;
  const ownerAddress = signer?.address ?? null;
  const pairUnavailable = !!mintIn && !!mintOut && !pool;

  return (
    <TokenPairForm
      ownerAddress={ownerAddress}
      submitting={swapMutation.isPending}
      canSubmit={canSubmit}
      buttonText={
        pairUnavailable ? "no pool for pair" : poolLocked ? "pool locked" : "swap"
      }
      submittingText="swapping…"
      disconnectedText={signer ? "select tokens & amount" : "connect wallet"}
      onSubmit={handleSubmit}
      middleIcon={<ArrowDown className="h-4 w-4" />}
      onMiddleClick={mintIn || mintOut ? handleFlip : undefined}
      middleAriaLabel="flip swap direction"
      top={{
        label: "sell",
        amount: amountIn,
        onAmountChange: setAmountIn,
        mint: mintIn,
        inputId: "swap-in",
        mintInputId: "swap-mint-in",
        mintSelect: (
          <PoolTokenCombobox
            id="swap-mint-in"
            value={mintIn}
            onChange={setMintIn}
            placeholder="select token"
            filterOut={mintOut || null}
          />
        ),
      }}
      bottom={{
        label: "buy",
        amount: expectedOutDisplay,
        onAmountChange: () => {},
        mint: mintOut,
        amountReadOnly: true,
        required: false,
        inputId: "swap-out",
        mintInputId: "swap-mint-out",
        mintSelect: (
          <PoolTokenCombobox
            id="swap-mint-out"
            value={mintOut}
            onChange={setMintOut}
            placeholder="select token"
            filterOut={mintIn || null}
          />
        ),
      }}
      footerSlot={
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <Label htmlFor="slippage" className="text-xs text-muted-foreground">
            slippage (bps)
          </Label>
          <Input
            id="slippage"
            type="number"
            min="0"
            max="10000"
            step="1"
            value={slippageBps}
            onChange={(e) => setSlippageBps(Number(e.target.value) || 0)}
            className="w-24 h-8 text-right !rounded-none"
          />
        </div>
      }
    />
  );
};
