import { Suspense } from "react";

import Header from "@/components/Header";

import { getSEOTags } from "@/lib/seo";
import { AmmPanel } from "@/components/Amm/AmmPanel";

export const metadata = getSEOTags({
  title: "amm | escrow.",
  description: "amm",
  canonicalUrlRelative: "/amm",
  openGraph: {
    images: [{ url: "/images/home.png", width: 1200, height: 630 }],
  },
});

export default function AmmPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense>
        <Header />
      </Suspense>
      <main className="flex flex-col justify-center grow">
        <div className="w-full md:max-w-5xl mx-auto px-4 md:px-8 pt-8">
          <AmmPanel />
        </div>
      </main>
    </div>
  );
}
