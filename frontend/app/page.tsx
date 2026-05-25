import { Suspense } from "react";

import Header from "@/components/Header";
import Hero from "@/components/Hero";

import { getSEOTags } from "@/lib/seo";
import { CollectionsTable } from "@/components/CollectionsTable";
import { AmmPanel } from "@/components/Amm/AmmPanel";

export const metadata = getSEOTags({
  title: "escrow.",
  description: "community headquarters",
  canonicalUrlRelative: "/",
  openGraph: {
    images: [{ url: "/images/twitter-image.png", width: 1200, height: 630 }],
  },
});

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense>
        <Header />
      </Suspense>
      <main className="flex flex-col justify-center grow">
        {/* <Hero posts={posts} /> */}
        <div className="w-full md:max-w-5xl mx-auto px-4 md:px-8 pt-8">
          <AmmPanel />
        </div>
        {/* <CollectionsTable className="md:max-w-5xl " /> */}
      </main>
    </div>
  );
}
