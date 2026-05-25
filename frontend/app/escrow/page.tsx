import { Suspense } from "react";

import Header from "@/components/Header";

import { getSEOTags } from "@/lib/seo";
import { EscrowPanel } from "@/components/Escrow/EscrowPanel";

export const metadata = getSEOTags({
  title: "escrow | escrow.",
  description: "escrow",
  canonicalUrlRelative: "/escrow",
  openGraph: {
    images: [{ url: "/images/home.png", width: 1200, height: 630 }],
  },
});

export default function EscrowPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense>
        <Header />
      </Suspense>
      <main className="grow">
        <div className="grid grid-cols-8 pt-[16.6667vh]">
          <div className="col-start-3 col-span-4 border border-network p-6">
            <EscrowPanel bare />
          </div>
        </div>
      </main>
    </div>
  );
}
