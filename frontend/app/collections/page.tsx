import { Suspense } from "react";

import Header from "@/components/Header";

import { getSEOTags } from "@/lib/seo";
import { CollectionsTable } from "@/components/CollectionsTable";
import { CollectionsTabs } from "@/components/CollectionsTabs";

export const metadata = getSEOTags({
  title: "collections | escrow.",
  description: "",
  canonicalUrlRelative: "/",
  openGraph: {
    images: [{ url: "/images/home.png", width: 1200, height: 630 }],
  },
});

export default function Home() {
  // const posts = getAllPosts();
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense>
        <Header />
      </Suspense>
      <main className="w-full flex flex-col justify-center grow">
        <CollectionsTabs />
        <CollectionsTable />
      </main>
    </div>
  );
}
