"use client";

import { useState, type FC } from "react";
import { Plus } from "lucide-react";
import type { TransactionSendingSigner } from "@solana/kit";

import { Button } from "@/components/ui/button";
import { useProgram } from "@/components/providers/Program";
import { columns as poolColumns } from "@/components/tables/pools/columns";
import { PoolsDataTable } from "@/components/tables/pools/data-table";
import type { Pool } from "@/lib/amm";
import { LpForm } from "./LpForm";
import { InitPoolForm } from "./InitPoolForm";

type View = "list" | "init" | "deposit";

type Props = { signer: TransactionSendingSigner | null };

export const LpTab: FC<Props> = ({ signer }) => {
  const { pools, isLoading } = useProgram();
  const [view, setView] = useState<View>("list");
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);

  const goBack = () => {
    setView("list");
    setSelectedPool(null);
  };

  if (view === "deposit" && selectedPool) {
    return (
      <LpForm signer={signer} selectedPool={selectedPool} onBack={goBack} />
    );
  }

  if (view === "init") {
    return <InitPoolForm signer={signer} onBack={goBack} />;
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="network"
        size="lg"
        onClick={() => setView("init")}
        className="w-full hover:text-white !rounded-none"
      >
        <Plus className="h-4 w-4 mr-2" /> create pool
      </Button>
      <PoolsDataTable
        columns={poolColumns}
        data={pools}
        isLoading={isLoading}
        selectedPool={null}
        onDepositClick={(pool) => {
          setSelectedPool(pool);
          setView("deposit");
        }}
      />
    </div>
  );
};
