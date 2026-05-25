"use client";

import { useState, type FC, type FormEvent } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  address as toAddress,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase58Decoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
  type TransactionSendingSigner,
} from "@solana/kit";
import {
  getLockInstructionAsync,
  getSetAdminInstructionAsync,
  getUnlockInstructionAsync,
} from "@trib3/anchor-amm-sdk";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRpc, truncateAddress } from "@/lib/escrow";
import { useProgram } from "@/components/providers/Program";
import {
  ammAnalyticsQueryKey,
  ammPoolsQueryKey,
  type Pool,
} from "@/lib/amm";

type Props = { signer: TransactionSendingSigner | null };

async function sendTx(
  rpc: ReturnType<typeof useRpc>["rpc"],
  signer: TransactionSendingSigner,
  ixs: any[],
): Promise<string> {
  const { value: latest } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
    (m) => appendTransactionMessageInstructions(ixs, m),
  );
  const sigBytes = await signAndSendTransactionMessageWithSigners(message);
  return getBase58Decoder().decode(sigBytes);
}

export const AdminTab: FC<Props> = ({ signer }) => {
  const { rpc, rpcUrl } = useRpc();
  const queryClient = useQueryClient();
  const { pools, analytics, isAdmin } = useProgram();

  const [selectedConfig, setSelectedConfig] = useState<string>("");
  const [newAdmin, setNewAdmin] = useState<string>("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ammPoolsQueryKey(rpcUrl) });
    queryClient.invalidateQueries({ queryKey: ammAnalyticsQueryKey(rpcUrl) });
  };

  const lockMutation = useMutation({
    mutationFn: async () => {
      if (!signer) throw new Error("connect wallet");
      if (!selectedConfig) throw new Error("select pool");
      const ix = await getLockInstructionAsync({
        authority: signer,
        config: toAddress(selectedConfig),
      });
      return sendTx(rpc, signer, [ix]);
    },
    onSuccess: (sig) => toast.success(`locked — ${sig.slice(0, 8)}…`),
    onError: (err) => toast.error(err instanceof Error ? err.message : "lock failed"),
    onSettled: invalidate,
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      if (!signer) throw new Error("connect wallet");
      if (!selectedConfig) throw new Error("select pool");
      const ix = await getUnlockInstructionAsync({
        authority: signer,
        config: toAddress(selectedConfig),
      });
      return sendTx(rpc, signer, [ix]);
    },
    onSuccess: (sig) => toast.success(`unlocked — ${sig.slice(0, 8)}…`),
    onError: (err) => toast.error(err instanceof Error ? err.message : "unlock failed"),
    onSettled: invalidate,
  });

  const setAdminMutation = useMutation({
    mutationFn: async () => {
      if (!signer) throw new Error("connect wallet");
      if (!newAdmin.trim()) throw new Error("paste new admin pubkey");
      const ix = await getSetAdminInstructionAsync({
        admin: signer,
        newAdmin: toAddress(newAdmin.trim()),
      });
      return sendTx(rpc, signer, [ix]);
    },
    onSuccess: (sig) => {
      toast.success(`admin rotated — ${sig.slice(0, 8)}…`);
      setNewAdmin("");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "set_admin failed"),
    onSettled: invalidate,
  });

  if (!isAdmin) {
    return (
      <div className="border border-network p-3 text-xs text-muted-foreground space-y-1">
        <div>admin tab restricted</div>
        {analytics && (
          <div className="font-mono">
            current admin: {truncateAddress(analytics.admin)}
          </div>
        )}
      </div>
    );
  }

  const selectedPool: Pool | null =
    pools.find((p) => String(p.address) === selectedConfig) ?? null;
  const locked = !!selectedPool && selectedPool.data.locked;

  return (
    <div className="space-y-4">
      <div className="border border-network p-3 space-y-3">
        <div className="text-xs text-muted-foreground uppercase">lock / unlock pool</div>
        <div className="space-y-1">
          <Label htmlFor="admin-pool" className="text-xs text-muted-foreground">
            pool
          </Label>
          <select
            id="admin-pool"
            value={selectedConfig}
            onChange={(e) => setSelectedConfig(e.target.value)}
            disabled={pools.length === 0}
            className="w-full border border-input bg-background px-3 py-2 text-sm font-mono !rounded-none disabled:opacity-50"
          >
            <option value="">select pool</option>
            {pools.map((p) => (
              <option key={p.address} value={p.address}>
                {truncateAddress(p.address)} · seed {p.data.seed.toString()} ·{" "}
                {p.data.locked ? "[locked]" : "[unlocked]"}
              </option>
            ))}
          </select>
        </div>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            (locked ? unlockMutation : lockMutation).mutate();
          }}
          className="flex gap-2"
        >
          <Button
            type="submit"
            variant="network"
            disabled={!selectedConfig || lockMutation.isPending || unlockMutation.isPending}
            className="flex-1 !rounded-none hover:text-white"
          >
            {locked
              ? unlockMutation.isPending ? "unlocking…" : "unlock"
              : lockMutation.isPending ? "locking…" : "lock"}
          </Button>
        </form>
      </div>

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setAdminMutation.mutate();
        }}
        className="border border-network p-3 space-y-3"
      >
        <div className="text-xs text-muted-foreground uppercase">rotate admin</div>
        <div className="space-y-1">
          <Label htmlFor="new-admin" className="text-xs text-muted-foreground">
            new admin pubkey
          </Label>
          <Input
            id="new-admin"
            value={newAdmin}
            onChange={(e) => setNewAdmin(e.target.value)}
            placeholder="pubkey…"
            className="font-mono !rounded-none"
          />
        </div>
        <Button
          type="submit"
          variant="network"
          disabled={!newAdmin.trim() || setAdminMutation.isPending}
          className="w-full !rounded-none hover:text-white"
        >
          {setAdminMutation.isPending ? "rotating…" : "set admin"}
        </Button>
      </form>
    </div>
  );
};
