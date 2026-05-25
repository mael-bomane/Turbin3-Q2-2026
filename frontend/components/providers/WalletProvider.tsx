"use client";

import { getWallets } from "@wallet-standard/app";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// Derive types from getWallets() so they always match the library internals
type StandardWallets = ReturnType<typeof getWallets>;
export type Wallet = ReturnType<StandardWallets["get"]>[number];
export type WalletAccount = Wallet["accounts"][number];

interface ConnectFeature {
  connect(input?: { silent?: boolean }): Promise<{ accounts: readonly WalletAccount[] }>;
}
interface DisconnectFeature {
  disconnect(): Promise<void>;
}

function isSolanaWallet(wallet: Wallet): boolean {
  return wallet.chains.some((chain) => chain.startsWith("solana:"));
}

function hasConnectFeature(
  wallet: Wallet,
): wallet is Wallet & { features: { "standard:connect": ConnectFeature } } {
  return "standard:connect" in wallet.features;
}

function hasDisconnectFeature(
  wallet: Wallet,
): wallet is Wallet & { features: { "standard:disconnect": DisconnectFeature } } {
  return "standard:disconnect" in wallet.features;
}

interface WalletContextType {
  wallets: Wallet[];
  wallet: Wallet | null;
  account: WalletAccount | null;
  connect: (wallet: Wallet) => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);

  useEffect(() => {
    const { get, on } = getWallets();

    // Always re-read the full list from get() on any change
    const sync = () => {
      const detected = get().filter(isSolanaWallet) as Wallet[];
      console.log("[WalletProvider] detected wallets:", detected.map((w) => w.name));
      setWallets(detected);
    };

    sync();

    const offRegister = on("register", sync);
    const offUnregister = on("unregister", sync);

    return () => {
      offRegister();
      offUnregister();
    };
  }, []);

  const connect = useCallback(async (selected: Wallet) => {
    console.log("[WalletProvider] connecting to:", selected.name);
    console.log("[WalletProvider] features:", Object.keys(selected.features));
    if (!hasConnectFeature(selected)) {
      throw new Error(`${selected.name} does not support standard:connect`);
    }
    const result = await selected.features["standard:connect"].connect();
    console.log("[WalletProvider] connect result:", result);
    if (result.accounts.length > 0) {
      setWallet(selected);
      setAccount(result.accounts[0] as WalletAccount);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!wallet) return;
    if (hasDisconnectFeature(wallet)) {
      await wallet.features["standard:disconnect"].disconnect();
    }
    setWallet(null);
    setAccount(null);
  }, [wallet]);

  return (
    <WalletContext.Provider value={{ wallets, wallet, account, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within WalletProvider");
  return context;
};
