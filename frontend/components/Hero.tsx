"use client";

import { CollectionCard } from "./CollectionCard";

import type { FC } from "react";
import type { Post } from "@/types";

type Props = {
  posts: Post[];
};

const Hero: FC<Props> = ({ posts }) => {
  const charts: Post[] = [
    {
      title: "coming soon",
      slug: "solana-stake-evolution",
      date: new Date("2026-04-02"),
      blockchain: "solana",
    },
    {
      title: "coming soon",
      slug: "drift-funding-rates",
      date: new Date("2026-04-04"),
      blockchain: "solana",
    },
    {
      title: "coming soon",
      slug: "solana-alpenglow-quorum",
      date: new Date("2025-08-09"),
      blockchain: "solana",
    },
    {
      title: "coming soon",
      slug: "solana-stake-geography",
      date: new Date("2025-08-09"),
      blockchain: "solana",
    },
  ];

  return (
    <section className="text-secondary w-full md:max-w-7xl mx-auto flex grow flex-col items-center md:px-8 z-[2]">
      <div className="relative w-full flex flex-col items-center">
        <div
          className="relative w-full h-[80vh] flex flex-col justify-end bg-contain bg-no-repeat bg-top"
          style={{ backgroundImage: "url('/azuki-1.png')" }}
        >
          {/* grey filter */}
          <div className="absolute inset-0 bg-black/30" />
          {/* bottom fade */}
          <div
            className="absolute bottom-0 left-0 w-full h-2/3"
            style={{
              background: "linear-gradient(to bottom, transparent, #070707)",
            }}
          />
          {/* left edge */}
          <div
            className="absolute inset-y-0 left-0 w-1/3"
            style={{
              background: "linear-gradient(to right, #070707, transparent)",
            }}
          />
          {/* right edge */}
          <div
            className="absolute inset-y-0 right-0 w-1/3"
            style={{
              background: "linear-gradient(to left, #070707, transparent)",
            }}
          />
          {/* hero collection */}
          <div></div>
          {/* featured collections */}
          <div className="text-secondary w-[95%] md:max-w-7xl mx-auto flex md:px-8 py-8 z-[2] space-x-4">
            {charts.slice(0, 4).map((post, i) => (
              <CollectionCard post={post} key={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
