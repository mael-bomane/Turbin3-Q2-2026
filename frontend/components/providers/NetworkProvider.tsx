"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Network = "solana";

export const NETWORK_CONFIG: Record<Network, { label: string; rpc: string }> = {
  solana: {
    label: "Solana",
    rpc: "https://api.devnet.solana.com",
  },
};

interface NetworkContextType {
  network: Network;
  rpc: string;
  setNetwork: (network: Network) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<Network>("solana");

  useEffect(() => {
    document.documentElement.dataset.network = network;
  }, [network]);

  return (
    <NetworkContext.Provider
      value={{ network, rpc: NETWORK_CONFIG[network].rpc, setNetwork }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) throw new Error("useNetwork must be used within NetworkProvider");
  return context;
}
