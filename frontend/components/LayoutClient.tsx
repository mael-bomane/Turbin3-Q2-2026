"use client";

import NextTopLoader from "nextjs-toploader";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { Tooltip } from "react-tooltip";

import { SolanaProvider } from "@/components/providers/SolanaProvider";
import { CollectionsTabsProvider } from "@/components/providers/CollectionsTabsProvider";
import { WalletProvider } from "@/components/providers/WalletProvider";
import { NetworkProvider } from "@/components/providers/NetworkProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ProgramProvider } from "@/components/providers/Program";
import { Footer } from "@/components/Footer";

import type { ReactNode } from "react";

const ClientLayout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <NextTopLoader color="#14F195" showSpinner={false} />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        forcedTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        <QueryProvider>
          <NetworkProvider>
              <SolanaProvider>
                <WalletProvider>
                  <ProgramProvider>
                    <CollectionsTabsProvider>
                      <main className="flex-1 flex flex-col">{children}</main>
                      <Footer />
                    </CollectionsTabsProvider>
                  </ProgramProvider>
                </WalletProvider>
              </SolanaProvider>
          </NetworkProvider>
        </QueryProvider>
      </ThemeProvider>
      <Toaster
        duration={3000}
        toastOptions={{
          classNames: {
            toast:
              "!bg-background !rounded-none !border-network !text-network",
          },
        }}
      />
      <Tooltip
        id="tooltip"
        className="z-[60] !opacity-100 max-w-sm shadow-lg"
      />
    </>
  );
};

export default ClientLayout;
