"use client";

import { useMemo } from "react";
import { getOrCreateUiWalletAccountForStandardWalletAccount } from "@wallet-standard/ui-registry";
import { useWalletAccountTransactionSendingSigner } from "@solana/react";
import type { TransactionSendingSigner } from "@solana/kit";

import type {
  Wallet,
  WalletAccount,
} from "@/components/providers/WalletProvider";
import type { SolanaChain } from "@/lib/escrow";

export function useEscrowSigner(
  wallet: Wallet,
  account: WalletAccount,
  chain: SolanaChain,
): TransactionSendingSigner {
  const uiAccount = useMemo(
    () => getOrCreateUiWalletAccountForStandardWalletAccount(wallet, account),
    [wallet, account],
  );
  return useWalletAccountTransactionSendingSigner(uiAccount, chain);
}
