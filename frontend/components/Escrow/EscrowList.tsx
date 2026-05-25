"use client";

import { useState, type FC } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase58Decoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
  type Address,
  type TransactionSendingSigner,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getSyncNativeInstruction,
} from "@solana-program/token";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  ANCHOR_ESCROW_PROGRAM_ADDRESS,
  ESCROW_DISCRIMINATOR,
  getEscrowDecoder,
  getEscrowSize,
  getRefundInstructionAsync,
  getTakeInstructionAsync,
  type Escrow,
} from "@trib3/anchor-escrow-sdk";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useRpc,
  useExplorer,
  fromBaseUnits,
  toBaseUnits,
  truncateAddress,
  WSOL_MINT,
} from "@/lib/escrow";
import { useMintDecimals } from "@/lib/userTokens";
import { TokenChip } from "./TokenChip";
import { AddressActions } from "./AddressActions";

type Row = { address: Address; data: Escrow };

const AmountChip: FC<{
  mint: Address;
  amount: bigint;
  tone: "in" | "out";
}> = ({ mint, amount, tone }) => {
  const { data: decimals } = useMintDecimals(mint);
  const formatted = decimals === null || decimals === undefined
    ? "…"
    : fromBaseUnits(amount, decimals);
  const toneClass =
    tone === "in"
      ? "text-emerald-500 dark:text-emerald-400"
      : "text-rose-500 dark:text-rose-400";
  return <TokenChip mint={mint} amount={formatted} className={toneClass} />;
};

type Props = {
  signer: TransactionSendingSigner | null;
  walletAddress: string | null;
  refreshKey?: number;
};

const escrowsQueryKey = (rpcUrl: string) => ["escrows", rpcUrl] as const;

export const EscrowList: FC<Props> = ({ signer, walletAddress }) => {
  const { rpc, rpcUrl } = useRpc();
  const explorer = useExplorer();
  const queryClient = useQueryClient();
  const queryKey = escrowsQueryKey(rpcUrl);

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<Row[]> => {
      const discBase58 = getBase58Decoder().decode(ESCROW_DISCRIMINATOR);
      const res = await rpc
        .getProgramAccounts(ANCHOR_ESCROW_PROGRAM_ADDRESS, {
          encoding: "base64",
          filters: [
            { dataSize: BigInt(getEscrowSize()) },
            {
              memcmp: {
                offset: BigInt(0),
                bytes: discBase58 as any,
                encoding: "base58",
              },
            },
          ],
        })
        .send();
      const decoder = getEscrowDecoder();
      const items = (Array.isArray(res) ? res : (res as any).value) as Array<{
        pubkey: Address;
        account: { data: [string, string] };
      }>;
      return items.map(({ pubkey, account: acc }) => {
        const bytes = Uint8Array.from(Buffer.from(acc.data[0], "base64"));
        return { address: pubkey, data: decoder.decode(bytes) };
      });
    },
  });

  const removeRow = (address: Address) => {
    queryClient.setQueryData<Row[]>(queryKey, (prev) =>
      (prev ?? []).filter((r) => r.address !== address),
    );
  };

  const sendTx = async (ixs: any[]) => {
    if (!signer) throw new Error("connect wallet first");
    const { value: latest } = await rpc.getLatestBlockhash().send();
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(signer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
      (m) => appendTransactionMessageInstructions(ixs, m),
    );
    const sigBytes = await signAndSendTransactionMessageWithSigners(message);
    return getBase58Decoder().decode(sigBytes);
  };

  const buildWrapSolIxs = async (amount: bigint) => {
    if (!signer) throw new Error("connect wallet first");
    const [wsolAta] = await findAssociatedTokenPda({
      owner: signer.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      mint: WSOL_MINT,
    });
    const createAta = await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer: signer,
      ata: wsolAta,
      owner: signer.address,
      mint: WSOL_MINT,
    });
    const fundAta = getTransferSolInstruction({
      source: signer,
      destination: wsolAta,
      amount,
    });
    const sync = getSyncNativeInstruction({ account: wsolAta });
    return [createAta, fundAta, sync];
  };

  const takeMutation = useMutation({
    mutationFn: async ({
      row,
      amountARequested,
    }: {
      row: Row;
      amountARequested: bigint;
    }) => {
      if (!signer) throw new Error("connect wallet first");
      const takeIx = await getTakeInstructionAsync({
        taker: signer,
        maker: row.data.maker,
        mintA: row.data.mintA,
        mintB: row.data.mintB,
        escrow: row.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        amountARequested,
      });
      // amount_b_due = ceil(amountARequested * remaining_b / remaining_a)
      const amountBDue =
        (amountARequested * row.data.amountB + row.data.amountA - 1n) /
        row.data.amountA;
      const ixs =
        row.data.mintB === WSOL_MINT
          ? [...(await buildWrapSolIxs(amountBDue)), takeIx]
          : [takeIx];
      const fullFill = amountARequested === row.data.amountA;
      return { sig: await sendTx(ixs), address: row.address, fullFill };
    },
    onSuccess: ({ sig, address, fullFill }) => {
      if (fullFill) removeRow(address);
      else queryClient.invalidateQueries({ queryKey });
      toast.success(`take ok — ${sig.slice(0, 8)}…`);
    },
    onError: (err) => {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "take failed");
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (row: Row) => {
      if (!signer) throw new Error("connect wallet first");
      const ix = await getRefundInstructionAsync({
        maker: signer,
        mintA: row.data.mintA,
        escrow: row.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });
      return { sig: await sendTx([ix]), address: row.address };
    },
    onSuccess: ({ sig, address }) => {
      removeRow(address);
      toast.success(`refund ok — ${sig.slice(0, 8)}…`);
    },
    onError: (err) => {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "refund failed");
    },
  });

  const busyAddress =
    takeMutation.isPending && takeMutation.variables
      ? takeMutation.variables.row.address
      : refundMutation.isPending && refundMutation.variables
        ? refundMutation.variables.address
        : null;

  if (isLoading && rows.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        loading offers…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        no open offers
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <EscrowRow
          key={row.address}
          row={row}
          isMaker={!!walletAddress && row.data.maker === walletAddress}
          isBusy={busyAddress === row.address}
          signerReady={!!signer}
          explorer={explorer}
          onTake={(amountARequested) => takeMutation.mutate({ row, amountARequested })}
          onRefund={() => refundMutation.mutate(row)}
        />
      ))}
    </div>
  );
};

type RowProps = {
  row: Row;
  isMaker: boolean;
  isBusy: boolean;
  signerReady: boolean;
  explorer: (a: string | Address, k?: "address" | "tx") => string;
  onTake: (amountARequested: bigint) => void;
  onRefund: () => void;
};

const EscrowRow: FC<RowProps> = ({
  row,
  isMaker,
  isBusy,
  signerReady,
  explorer,
  onTake,
  onRefund,
}) => {
  const { data: decimalsA } = useMintDecimals(row.data.mintA);
  const [input, setInput] = useState("");

  const decimalsReady = decimalsA !== null && decimalsA !== undefined;
  const remainingHuman = decimalsReady ? fromBaseUnits(row.data.amountA, decimalsA) : "";

  const parsed = (() => {
    if (!decimalsReady) return { value: null as bigint | null, error: null as string | null };
    const raw = input.trim() === "" ? remainingHuman : input.trim();
    try {
      const v = toBaseUnits(raw, decimalsA);
      if (v <= 0n) return { value: null, error: "amount must be > 0" };
      if (v > row.data.amountA) return { value: null, error: "exceeds remaining" };
      return { value: v, error: null };
    } catch {
      return { value: null, error: "invalid amount" };
    }
  })();

  const takeDisabled = isBusy || !signerReady || !decimalsReady || parsed.value === null;

  return (
    <div className="flex items-center justify-between gap-3 p-3 border border-network font-mono text-xs">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">offer</span>
          <a
            href={explorer(row.address)}
            target="_blank"
            rel="noopener noreferrer"
            title={String(row.address)}
            className="hover:underline underline-offset-2 hover:text-network transition-colors"
          >
            {truncateAddress(row.address)}
          </a>
          <AddressActions address={row.address} />
          <span className="text-muted-foreground">by</span>
          <a
            href={explorer(row.data.maker)}
            target="_blank"
            rel="noopener noreferrer"
            title={String(row.data.maker)}
            className="hover:underline underline-offset-2 hover:text-network transition-colors"
          >
            {truncateAddress(row.data.maker)}
          </a>
          <AddressActions address={row.data.maker} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AmountChip
            mint={row.data.mintA}
            amount={row.data.amountA}
            tone={isMaker ? "out" : "in"}
          />
          <span className="text-muted-foreground">{isMaker ? "→" : "←"}</span>
          <AmountChip
            mint={row.data.mintB}
            amount={row.data.amountB}
            tone={isMaker ? "in" : "out"}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isMaker ? (
          <Button
            size="sm"
            variant="outline"
            disabled={isBusy || !signerReady}
            onClick={onRefund}
            className="!rounded-none"
          >
            {isBusy ? "…" : "refund"}
          </Button>
        ) : (
          <>
            <Input
              type="text"
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={remainingHuman || "amount"}
              disabled={isBusy || !decimalsReady}
              className="h-8 w-28 !rounded-none font-mono text-xs"
              title={parsed.error ?? `max ${remainingHuman}`}
            />
            <Button
              size="sm"
              variant="network"
              disabled={takeDisabled}
              onClick={() => parsed.value !== null && onTake(parsed.value)}
              className="hover:text-white"
            >
              {isBusy ? "…" : "take"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export { escrowsQueryKey };
