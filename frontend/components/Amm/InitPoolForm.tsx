"use client";

import { useState, type FC, type FormEvent } from "react";
import { ArrowRight, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  address as toAddress,
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
  type TransactionSendingSigner,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  CONFIG_DISCRIMINATOR,
  findConfigPda,
  findMintLpPda,
  getDepositInstructionAsync,
  getInitializeInstructionAsync,
} from "@trib3/anchor-amm-sdk";
import type { Address } from "@solana/kit";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRpc, toBaseUnits } from "@/lib/escrow";
import { useMintDecimals } from "@/lib/userTokens";
import { TokenPairForm } from "@/components/shared/TokenPairForm";
import {
  ammAnalyticsQueryKey,
  ammPoolsQueryKey,
  buildWsolTopUpInstructions,
  isWsol,
  quoteLpFromDeposit,
  type AnalyticsData,
  type Pool,
} from "@/lib/amm";

type Props = {
  signer: TransactionSendingSigner | null;
  onBack?: () => void;
};

export const InitPoolForm: FC<Props> = ({ signer, onBack }) => {
  const { rpc, rpcUrl } = useRpc();
  const queryClient = useQueryClient();

  const [mintX, setMintX] = useState("");
  const [mintY, setMintY] = useState("");
  const [amountX, setAmountX] = useState("");
  const [amountY, setAmountY] = useState("");
  const [feeBps, setFeeBps] = useState(30);

  const ownerAddress = signer?.address ?? null;
  const decX = useMintDecimals(mintX || null);
  const decY = useMintDecimals(mintY || null);

  type InitVars = {
    seed: bigint;
    mintXAddr: Address;
    mintYAddr: Address;
    configPda: Address;
    configBump: number;
    lpBump: number;
    feeBps: number;
    wantsSeed: boolean;
    amountXBase: bigint;
    amountYBase: bigint;
  };

  const initMutation = useMutation({
    mutationFn: async ({
      seed,
      mintXAddr,
      mintYAddr,
      configPda,
      feeBps,
      wantsSeed,
      amountXBase,
      amountYBase,
    }: InitVars) => {
      if (!signer) throw new Error("connect wallet first");

      const initIx = await getInitializeInstructionAsync({
        payer: signer,
        mintX: mintXAddr,
        mintY: mintYAddr,
        seed,
        fee: feeBps,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });

      const ixs: any[] = [initIx];

      if (wantsSeed) {
        const lp = quoteLpFromDeposit(amountXBase, amountYBase, 0n, 0n, 0n);
        if (lp <= 0n) throw new Error("computed lp = 0");

        const wsolNeeded = isWsol(mintXAddr)
          ? amountXBase
          : isWsol(mintYAddr)
            ? amountYBase
            : 0n;
        if (wsolNeeded > 0n) {
          const wrapIxs = await buildWsolTopUpInstructions(rpc, signer, wsolNeeded);
          ixs.push(...wrapIxs);
        }

        const depositIx = await getDepositInstructionAsync({
          user: signer,
          mintX: mintXAddr,
          mintY: mintYAddr,
          config: configPda,
          amount: lp,
          maxX: amountXBase,
          maxY: amountYBase,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        });
        ixs.push(depositIx);
      }

      const { value: latest } = await rpc.getLatestBlockhash().send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(signer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
        (m) => appendTransactionMessageInstructions(ixs, m),
      );

      // Pre-simulate on-chain to surface real program errors before the wallet
      // swallows them as "Unexpected error".
      const compiled = compileTransaction(message);
      const wire = getBase64EncodedWireTransaction(compiled);
      const sim = await rpc
        .simulateTransaction(wire, {
          encoding: "base64",
          sigVerify: false,
          replaceRecentBlockhash: true,
        })
        .send();
      if (sim.value.err) {
        const logs = (sim.value.logs ?? []).join("\n");
        console.error("init sim err:", sim.value.err);
        console.error("init sim logs:\n" + logs);
        const errStr = JSON.stringify(sim.value.err, (_k, v) =>
          typeof v === "bigint" ? v.toString() : v,
        );
        throw new Error(`simulation failed: ${errStr}\n${logs}`);
      }

      const sigBytes = await signAndSendTransactionMessageWithSigners(message);
      return getBase58Decoder().decode(sigBytes);
    },
    onMutate: async (vars: InitVars) => {
      const poolsKey = ammPoolsQueryKey(rpcUrl);
      const analyticsKey = ammAnalyticsQueryKey(rpcUrl);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: poolsKey }),
        queryClient.cancelQueries({ queryKey: analyticsKey }),
      ]);
      const prevPools = queryClient.getQueryData<Pool[]>(poolsKey);
      const prevAnalytics =
        queryClient.getQueryData<AnalyticsData | null>(analyticsKey);

      const optimisticPool: Pool = {
        address: vars.configPda,
        data: {
          discriminator: CONFIG_DISCRIMINATOR,
          seed: vars.seed,
          mintX: vars.mintXAddr,
          mintY: vars.mintYAddr,
          fee: vars.feeBps,
          locked: false,
          activated: false,
          configBump: vars.configBump,
          lpBump: vars.lpBump,
        } as Pool["data"],
      };
      if (prevPools) {
        queryClient.setQueryData<Pool[]>(poolsKey, [...prevPools, optimisticPool]);
      }
      if (prevAnalytics) {
        const wsolAdd =
          vars.wantsSeed
            ? isWsol(vars.mintXAddr)
              ? vars.amountXBase
              : isWsol(vars.mintYAddr)
                ? vars.amountYBase
                : 0n
            : 0n;
        queryClient.setQueryData<AnalyticsData>(analyticsKey, {
          ...prevAnalytics,
          pairsCreated: prevAnalytics.pairsCreated + 1n,
          tvlWsol: prevAnalytics.tvlWsol + wsolAdd,
        });
      }
      return { prevPools, prevAnalytics, poolsKey, analyticsKey };
    },
    onSuccess: (sig) => {
      toast.success(`pool created — ${sig.slice(0, 8)}…`);
      setMintX("");
      setMintY("");
      setAmountX("");
      setAmountY("");
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.prevPools !== undefined)
        queryClient.setQueryData(ctx.poolsKey, ctx.prevPools);
      if (ctx?.prevAnalytics !== undefined)
        queryClient.setQueryData(ctx.analyticsKey, ctx.prevAnalytics);
      console.error("init pool error:", err);
      if (err?.cause) console.error("cause:", err.cause);
      if (err?.context) console.error("context:", err.context);
      const msg =
        err?.context?.__serverMessage ||
        err?.cause?.message ||
        (err instanceof Error ? err.message : "init failed");
      toast.error(String(msg));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ammPoolsQueryKey(rpcUrl) });
      queryClient.invalidateQueries({ queryKey: ammAnalyticsQueryKey(rpcUrl) });
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!signer) {
      toast.error("connect wallet first");
      return;
    }
    if (!mintX.trim() || !mintY.trim()) {
      toast.error("select both mints");
      return;
    }
    if (mintX.trim() === mintY.trim()) {
      toast.error("mintX and mintY must differ");
      return;
    }
    const mintXAddr = toAddress(mintX.trim());
    const mintYAddr = toAddress(mintY.trim());
    const wantsSeed = amountX !== "" && amountY !== "";
    let amountXBase = 0n;
    let amountYBase = 0n;
    if (wantsSeed) {
      if (decX.data === null || decX.data === undefined) {
        toast.error("loading mint X decimals…");
        return;
      }
      if (decY.data === null || decY.data === undefined) {
        toast.error("loading mint Y decimals…");
        return;
      }
      amountXBase = toBaseUnits(amountX, decX.data);
      amountYBase = toBaseUnits(amountY, decY.data);
      if (amountXBase <= 0n || amountYBase <= 0n) {
        toast.error("seed amounts must be > 0");
        return;
      }
    }
    const seed = BigInt(Math.floor(Math.random() * 2 ** 32));
    const [configPda, configBump] = await findConfigPda({ seed });
    const [, lpBump] = await findMintLpPda({ config: configPda });
    initMutation.mutate({
      seed,
      mintXAddr,
      mintYAddr,
      configPda,
      configBump,
      lpBump,
      feeBps,
      wantsSeed,
      amountXBase,
      amountYBase,
    });
  };

  const form = (
    <TokenPairForm
      ownerAddress={ownerAddress}
      submitting={initMutation.isPending}
      canSubmit={!!signer && !!mintX.trim() && !!mintY.trim()}
      buttonText="create pool"
      submittingText="creating…"
      disconnectedText={signer ? "select both mints" : "connect wallet"}
      onSubmit={handleSubmit}
      middleIcon={<Plus className="h-4 w-4" />}
      middleAriaLabel="create pool"
      top={{
        label: "seed amount X (optional)",
        amount: amountX,
        onAmountChange: setAmountX,
        required: false,
        mint: mintX,
        onMintChange: (v) => setMintX(v),
        inputId: "init-x-amount",
        mintInputId: "init-x-mint",
      }}
      bottom={{
        label: "seed amount Y (optional)",
        amount: amountY,
        onAmountChange: setAmountY,
        required: false,
        mint: mintY,
        onMintChange: (v) => setMintY(v),
        inputId: "init-y-amount",
        mintInputId: "init-y-mint",
      }}
      footerSlot={
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <Label htmlFor="init-fee" className="text-xs text-muted-foreground">
            fee (bps)
          </Label>
          <Input
            id="init-fee"
            type="number"
            min="0"
            max="10000"
            step="1"
            value={feeBps}
            onChange={(e) => setFeeBps(Number(e.target.value) || 0)}
            className="w-24 h-8 text-right !rounded-none"
          />
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
          aria-label="close"
          className="text-muted-foreground hover:text-network transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onBack}
          aria-label="back to pools"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-network transition-colors"
        >
          <span>back to pools</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      {form}
    </div>
  );
};
