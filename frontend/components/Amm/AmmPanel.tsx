"use client";

import type { FC } from "react";
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
import { useEscrowSigner } from "@/components/Escrow/useEscrowSigner";
import { useProgram } from "@/components/providers/Program";
import { AdminTab } from "./AdminTab";
import { AnalyticsWidget } from "./AnalyticsWidget";
import { SwapForm } from "./SwapForm";
import { LpTab } from "./LpTab";

const ConnectedAmmPanel: FC<{
  wallet: NonNullable<ReturnType<typeof useWallet>["wallet"]>;
  account: NonNullable<ReturnType<typeof useWallet>["account"]>;
}> = ({ wallet, account }) => {
  const { chain } = useRpc();
  const signer = useEscrowSigner(wallet, account, chain);
  const { isAdmin } = useProgram();
  const cols = isAdmin ? "grid-cols-3" : "grid-cols-2";

  return (
    <Tabs defaultValue="swap" className="w-full">
      <TabsList className={`grid w-full ${cols} !rounded-none`}>
        <TabsTrigger value="swap" className="!rounded-none">swap</TabsTrigger>
        <TabsTrigger value="lp" className="!rounded-none">lp</TabsTrigger>
        {isAdmin && (
          <TabsTrigger value="admin" className="!rounded-none">admin</TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="swap" className="pt-4">
        <SwapForm signer={signer} />
      </TabsContent>
      <TabsContent value="lp" className="pt-4">
        <LpTab signer={signer} />
      </TabsContent>
      {isAdmin && (
        <TabsContent value="admin" className="pt-4">
          <AdminTab signer={signer} />
        </TabsContent>
      )}
    </Tabs>
  );
};

const DisconnectedAmmPanel: FC = () => (
  <Tabs defaultValue="swap" className="w-full">
    <TabsList className="grid w-full grid-cols-2 !rounded-none">
      <TabsTrigger value="swap" className="!rounded-none">swap</TabsTrigger>
      <TabsTrigger value="lp" className="!rounded-none">lp</TabsTrigger>
    </TabsList>
    <TabsContent value="swap" className="pt-4">
      <SwapForm signer={null} />
    </TabsContent>
    <TabsContent value="lp" className="pt-4">
      <LpTab signer={null} />
    </TabsContent>
  </Tabs>
);

export const AmmPanel: FC<{ bare?: boolean }> = ({ bare = false }) => {
  const { wallet, account } = useWallet();

  const body = wallet && account ? (
    <ConnectedAmmPanel wallet={wallet} account={account} />
  ) : (
    <DisconnectedAmmPanel />
  );

  if (bare) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-mono uppercase">constant product amm</h2>
          <p className="text-sm text-muted-foreground">
            swap, provide liquidity, or spin up a new pool.
          </p>
        </div>
        <AnalyticsWidget />
        {body}
      </div>
    );
  }

  return (
    <section className="w-full md:max-w-5xl mx-auto px-4 md:px-8 pt-2 pb-8 z-[2] space-y-4">
      <AnalyticsWidget />
      <Card className="!rounded-none">
        <CardHeader>
          <CardTitle className="text-xl font-mono uppercase">constant product amm</CardTitle>
          <CardDescription>
            swap, provide liquidity, or spin up a new pool.
          </CardDescription>
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
    </section>
  );
};
