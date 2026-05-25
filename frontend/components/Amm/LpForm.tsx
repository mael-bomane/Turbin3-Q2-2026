"use client";

import { useEffect, useMemo, useState, type FC, type FormEvent } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
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
import { getDepositInstructionAsync } from "@trib3/anchor-amm-sdk";

import { useRpc, toBaseUnits, fromBaseUnits } from "@/lib/escrow";
import { useMintDecimals } from "@/lib/userTokens";
import { TokenPairForm } from "@/components/shared/TokenPairForm";
import { useProgram } from "@/components/providers/Program";
import { PoolTokenCombobox } from "./PoolTokenCombobox";
import {
  ammAnalyticsQueryKey,
  ammLpSupplyQueryKey,
  ammReservesQueryKey,
  buildWsolTopUpInstructions,
  isWsol,
  quoteLpFromDeposit,
  useLpSupplyQuery,
  usePoolReservesQuery,
  type AnalyticsData,
  type Pool,
} from "@/lib/amm";

type Props = {
  signer: TransactionSendingSigner | null;
  selectedPool?: Pool | null;
  onBack?: () => void;
};

export const LpForm: FC<Props> = ({ signer, selectedPool, onBack }) => {
  const { rpc, rpcUrl } = useRpc();
  const queryClient = useQueryClient();
  const { findPool } = useProgram();

  const [mintXSel, setMintXSel] = useState(
    selectedPool ? String(selectedPool.data.mintX) : "",
  );
  const [mintYSel, setMintYSel] = useState(
    selectedPool ? String(selectedPool.data.mintY) : "",
  );
  const [amountXStr, setAmountXStr] = useState("");
  const [amountYStr, setAmountYStr] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);

  useEffect(() => {
    if (selectedPool) {
      setMintXSel(String(selectedPool.data.mintX));
      setMintYSel(String(selectedPool.data.mintY));
    }
  }, [selectedPool?.address]);

  const pool = useMemo<Pool | null>(() => {
    if (!mintXSel || !mintYSel) return null;
    return (
      findPool(mintXSel, mintYSel)[0] ?? findPool(mintYSel, mintXSel)[0] ?? null
    );
  }, [mintXSel, mintYSel, findPool]);

  // The pool's canonical mintX/mintY ordering: align user inputs to pool's orientation.
  const aligned = useMemo(() => {
    if (!pool) return null;
    const userMatches = String(pool.data.mintX) === mintXSel;
    return {
      amountXStr: userMatches ? amountXStr : amountYStr,
      amountYStr: userMatches ? amountYStr : amountXStr,
    };
  }, [pool, amountXStr, amountYStr, mintXSel]);

  const reserves = usePoolReservesQuery(pool);
  const lpSupply = useLpSupplyQuery(pool);
  const decX = useMintDecimals(pool?.data.mintX ?? null);
  const decY = useMintDecimals(pool?.data.mintY ?? null);

  const lpQuote = useMemo(() => {
    if (
      !pool ||
      !aligned ||
      decX.data === null || decX.data === undefined ||
      decY.data === null || decY.data === undefined ||
      lpSupply.data === undefined ||
      aligned.amountXStr === "" || aligned.amountYStr === ""
    )
      return null;
    const amountX = toBaseUnits(aligned.amountXStr, decX.data);
    const amountY = toBaseUnits(aligned.amountYStr, decY.data);
    const reserveX = reserves.data?.reserveX ?? 0n;
    const reserveY = reserves.data?.reserveY ?? 0n;
    const lp = quoteLpFromDeposit(amountX, amountY, reserveX, reserveY, lpSupply.data);
    return { amountX, amountY, lp };
  }, [pool, aligned, decX.data, decY.data, lpSupply.data, reserves.data]);

  const depositMutation = useMutation({
    mutationFn: async () => {
      if (!signer) throw new Error("connect wallet first");
      if (!pool) throw new Error("no pool for this pair");
      if (!lpQuote || lpQuote.lp <= 0n) throw new Error("invalid amounts");

      const slipFactor = BigInt(10_000 + slippageBps);
      const maxX = (lpQuote.amountX * slipFactor) / 10_000n;
      const maxY = (lpQuote.amountY * slipFactor) / 10_000n;

      const wsolNeeded = isWsol(pool.data.mintX)
        ? maxX
        : isWsol(pool.data.mintY)
          ? maxY
          : 0n;
      const wrapIxs =
        wsolNeeded > 0n
          ? await buildWsolTopUpInstructions(rpc, signer, wsolNeeded)
          : [];

      const ix = await getDepositInstructionAsync({
        user: signer,
        mintX: pool.data.mintX,
        mintY: pool.data.mintY,
        config: pool.address,
        amount: lpQuote.lp,
        maxX,
        maxY,
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
      if (!pool || !lpQuote) return { previous: null as any };
      const reservesKey = ammReservesQueryKey(rpcUrl, pool.address);
      const lpKey = ammLpSupplyQueryKey(rpcUrl, pool.address);
      const analyticsKey = ammAnalyticsQueryKey(rpcUrl);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: reservesKey }),
        queryClient.cancelQueries({ queryKey: lpKey }),
        queryClient.cancelQueries({ queryKey: analyticsKey }),
      ]);
      const prevReserves = queryClient.getQueryData<typeof reserves.data>(reservesKey);
      const prevLp = queryClient.getQueryData<bigint>(lpKey);
      const prevAnalytics =
        queryClient.getQueryData<AnalyticsData | null>(analyticsKey);

      if (prevReserves) {
        queryClient.setQueryData(reservesKey, {
          ...prevReserves,
          reserveX: prevReserves.reserveX + lpQuote.amountX,
          reserveY: prevReserves.reserveY + lpQuote.amountY,
        });
      }
      if (prevLp !== undefined) {
        queryClient.setQueryData(lpKey, prevLp + lpQuote.lp);
      }
      if (prevAnalytics) {
        const wsolAdd = isWsol(pool.data.mintX)
          ? lpQuote.amountX
          : isWsol(pool.data.mintY)
            ? lpQuote.amountY
            : 0n;
        if (wsolAdd > 0n) {
          queryClient.setQueryData<AnalyticsData>(analyticsKey, {
            ...prevAnalytics,
            tvlWsol: prevAnalytics.tvlWsol + wsolAdd,
          });
        }
      }
      return { prevReserves, prevLp, prevAnalytics, reservesKey, lpKey, analyticsKey };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.reservesKey && ctx.prevReserves !== undefined)
        queryClient.setQueryData(ctx.reservesKey, ctx.prevReserves);
      if (ctx?.lpKey && ctx.prevLp !== undefined)
        queryClient.setQueryData(ctx.lpKey, ctx.prevLp);
      if (ctx?.analyticsKey && ctx.prevAnalytics !== undefined)
        queryClient.setQueryData(ctx.analyticsKey, ctx.prevAnalytics);
      console.error(err);
      toast.error(err instanceof Error ? err.message : "deposit failed");
    },
    onSuccess: (sig) => {
      toast.success(`deposit ok — ${sig.slice(0, 8)}…`);
      setAmountXStr("");
      setAmountYStr("");
    },
    onSettled: () => {
      if (pool) {
        queryClient.invalidateQueries({
          queryKey: ammReservesQueryKey(rpcUrl, pool.address),
        });
        queryClient.invalidateQueries({
          queryKey: ammLpSupplyQueryKey(rpcUrl, pool.address),
        });
      }
      queryClient.invalidateQueries({ queryKey: ammAnalyticsQueryKey(rpcUrl) });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    depositMutation.mutate();
  };

  const lpDisplay = lpQuote ? fromBaseUnits(lpQuote.lp, 6) : "";
  const pairValid = !!mintXSel && !!mintYSel && !!pool;
  const poolLocked = !!pool && pool.data.locked;
  const canSubmit =
    !!signer && pairValid && !poolLocked && lpQuote !== null && lpQuote.lp > 0n;
  const pairUnavailable = !!mintXSel && !!mintYSel && !pool;
  const ownerAddress = signer?.address ?? null;

  const form = (
    <TokenPairForm
      ownerAddress={ownerAddress}
      submitting={depositMutation.isPending}
      canSubmit={canSubmit}
      buttonText={
        pairUnavailable
          ? "no pool for pair"
          : poolLocked
            ? "pool locked"
            : "add liquidity"
      }
      submittingText="depositing…"
      disconnectedText={signer ? "select tokens & amounts" : "connect wallet"}
      onSubmit={handleSubmit}
      middleIcon={<Plus className="h-4 w-4" />}
      middleAriaLabel="add liquidity"
      top={{
        label: "deposit",
        amount: amountXStr,
        onAmountChange: setAmountXStr,
        mint: mintXSel,
        inputId: "lp-x",
        mintInputId: "lp-mint-x",
        mintSelect: (
          <PoolTokenCombobox
            id="lp-mint-x"
            value={mintXSel}
            onChange={setMintXSel}
            placeholder="select token"
            filterOut={mintYSel || null}
          />
        ),
      }}
      bottom={{
        label: "deposit",
        amount: amountYStr,
        onAmountChange: setAmountYStr,
        mint: mintYSel,
        inputId: "lp-y",
        mintInputId: "lp-mint-y",
        mintSelect: (
          <PoolTokenCombobox
            id="lp-mint-y"
            value={mintYSel}
            onChange={setMintYSel}
            placeholder="select token"
            filterOut={mintXSel || null}
          />
        ),
      }}
      footerSlot={
        <div className="space-y-1 pt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>lp tokens (est.)</span>
            <span className="font-mono">{lpDisplay || "—"}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <label htmlFor="lp-slip">slippage (bps)</label>
            <input
              id="lp-slip"
              type="number"
              min="0"
              max="10000"
              step="1"
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.target.value) || 0)}
              className="w-24 h-8 border border-input bg-background px-2 text-right text-sm !rounded-none"
            />
          </div>
        </div>
      }
    />
  );

  if (!onBack) return form;

  return (
    <div className="relative border border-network p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="back to pools"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-network transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>back to pools</span>
        </button>
        <button
          type="button"
          onClick={onBack}
          aria-label="close"
          className="text-muted-foreground hover:text-network transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {form}
    </div>
  );
};
