"use client";

import { Flame, Image, Sparkles, Star } from "lucide-react";

import type { FC } from "react";
import { cn } from "@/lib/utils";
import { useCollectionsTabs, type CollectionsTab } from "@/components/providers/CollectionsTabsProvider";

export const CollectionsTabs: FC = () => {
  const { selected, setSelected } = useCollectionsTabs();

  const tabClass = (tab: CollectionsTab) =>
    cn(
      "flex items-center space-x-2 cursor-pointer",
      selected === tab ? "text-network" : "hover:opacity-80",
    );

  return (
    <section className="w-full flex justify-between z-[2] p-4">
      <div className="flex flex-1 justify-around">
        {/* collections */}
        <div
          className={tabClass("collections")}
          onClick={() => setSelected("collections")}
        >
          <Image className="w-5 h-5" />
          <span>collections</span>
        </div>
        {/* trending */}
        <div
          className={tabClass("trending")}
          onClick={() => setSelected("trending")}
        >
          <Flame className="w-5 h-5" />
          <span>trending</span>
        </div>
        {/* favorites */}
        <div
          className={tabClass("favorites")}
          onClick={() => setSelected("favorites")}
        >
          <Star className="w-5 h-5" />
          <span>favorites</span>
        </div>
        {/* points */}
        <div
          className={tabClass("points")}
          onClick={() => setSelected("points")}
        >
          <Sparkles className="w-5 h-5" />
          <span>points</span>
        </div>
      </div>
      <div className="flex flex-1 justify-around"></div>
    </section>
  );
};
