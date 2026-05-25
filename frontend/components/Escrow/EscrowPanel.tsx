"use client";

import type { FC } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useWallet } from "@/components/providers/WalletProvider";
import { useRpc } from "@/lib/escrow";
import { useEscrowSigner } from "./useEscrowSigner";
import { MakeForm } from "./MakeForm";
import { EscrowList, escrowsQueryKey } from "./EscrowList";
import { WalletButton } from "@/components/WalletButton";

const ConnectedEscrowPanel: FC<{
  wallet: NonNullable<ReturnType<typeof useWallet>["wallet"]>;
  account: NonNullable<ReturnType<typeof useWallet>["account"]>;
}> = ({ wallet, account }) => {
  const { chain, rpcUrl } = useRpc();
  const signer = useEscrowSigner(wallet, account, chain);
  const queryClient = useQueryClient();

  return (
    <Tabs defaultValue="make" className="w-full">
      <TabsList className="grid w-full grid-cols-2 !rounded-none">
        <TabsTrigger value="make" className="!rounded-none">
          make
        </TabsTrigger>
        <TabsTrigger value="take" className="!rounded-none">
          take
        </TabsTrigger>
      </TabsList>
      <TabsContent value="make" className="pt-4">
        <MakeForm
          signer={signer}
          onCreated={() =>
            queryClient.invalidateQueries({ queryKey: escrowsQueryKey(rpcUrl) })
          }
        />
      </TabsContent>
      <TabsContent value="take" className="pt-4">
        <EscrowList signer={signer} walletAddress={account.address} />
      </TabsContent>
    </Tabs>
  );
};

const DisconnectedEscrowPanel: FC = () => (
  <Tabs defaultValue="take" className="w-full">
    <TabsList className="grid w-full grid-cols-2 !rounded-none">
      <TabsTrigger value="make" className="!rounded-none">
        make
      </TabsTrigger>
      <TabsTrigger value="take" className="!rounded-none">
        take
      </TabsTrigger>
    </TabsList>
    <TabsContent value="make" className="pt-4">
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-sm text-muted-foreground">
          connect wallet to create an offer
        </p>
        <WalletButton />
      </div>
    </TabsContent>
    <TabsContent value="take" className="pt-4">
      <EscrowList signer={null} walletAddress={null} />
    </TabsContent>
  </Tabs>
);

export const EscrowPanel: FC<{ bare?: boolean }> = ({ bare = false }) => {
  const { wallet, account } = useWallet();

  const body = wallet && account ? (
    <ConnectedEscrowPanel wallet={wallet} account={account} />
  ) : (
    <DisconnectedEscrowPanel />
  );

  if (bare) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-mono uppercase">peer-to-peer spl market</h2>
          <p className="text-sm text-muted-foreground">
            atomic token swap : create an offer or take an open one.
          </p>
        </div>
        {body}
      </div>
    );
  }

  return (
    <section className="w-full md:max-w-5xl mx-auto px-4 md:px-8 py-8 z-[2]">
      <Card className="!rounded-none">
        <CardHeader>
          <CardTitle className="text-xl font-mono uppercase">peer-to-peer spl market</CardTitle>
          <CardDescription>
            atomic token swap : create an offer or take an open one.
          </CardDescription>
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
    </section>
  );
};
