"use client";

import { Check, Copy, LogOut } from "lucide-react";
import { useState } from "react";
import type { FC } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  useWallet,
  type Wallet as SolanaWallet,
} from "@/components/providers/WalletProvider";

function truncate(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export const WalletButton: FC = () => {
  const { wallets, account, connect, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleCopy = async () => {
    if (!account) return;
    await navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = async (wallet: SolanaWallet) => {
    setConnecting(true);
    try {
      await connect(wallet);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch {
      toast.error("failed to disconnect");
    }
  };

  // Connected state
  if (account) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="network"
            size="lg"
            className="hover:text-white font-mono"
          >
            {truncate(account.address)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={handleCopy}
            className="gap-2 cursor-pointer"
          >
            {copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? "copied!" : "copy address"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDisconnect}
            className="gap-2 cursor-pointer text-network focus:text-network"
          >
            <LogOut className="w-4 h-4" />
            disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // No wallet installed
  if (wallets.length === 0) {
    return (
      <Button
        variant="network"
        size="lg"
        className="hover:text-white"
        onClick={() => toast.error("no solana wallet detected")}
      >
        connect wallet
      </Button>
    );
  }

  // Single wallet: connect directly
  if (wallets.length === 1) {
    return (
      <Button
        variant="network"
        size="lg"
        className="hover:text-white"
        disabled={connecting}
        onClick={() => handleConnect(wallets[0])}
      >
        {connecting ? "connecting..." : "connect wallet"}
      </Button>
    );
  }

  // Multiple wallets: Radix dropdown with asChild
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="network"
          size="lg"
          className="hover:text-white"
          disabled={connecting}
        >
          {connecting ? "connecting..." : "connect wallet"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {wallets.map((wallet) => (
          <DropdownMenuItem
            key={wallet.name}
            onClick={() => handleConnect(wallet)}
            className="gap-2 cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={wallet.icon}
              alt={wallet.name}
              className="w-4 h-4 rounded-sm"
            />
            {wallet.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
