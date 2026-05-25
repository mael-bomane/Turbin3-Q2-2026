"use client";

import { Post } from "@/types";
import { FC } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatDate } from "@/lib/utils";
import Image from "next/image";
import SolanaLogo from "./icons/solana.svg";
import Link from "next/link";
import TvNoise from "./TVNoise";

// const blockchainLogos: Record<string, { src: string; alt: string }> = {
//   solana: { src: SolanaLogo, alt: "Solana" },
// };

type Props = {
  post: Post;
};

export const CollectionCard: FC<Props> = ({
  post: { slug, title, date, blockchain },
}) => {
  return (
    <Link
      href={`/${slug}`}
      className="group relative block w-full cursor-pointer bg-black dark:bg-network p-[4px] transition-all duration-300 [clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)] dark:drop-shadow-[0_0_8px_rgba(0,255,153,0.3)]"
    >
      <TvNoise className="absolute h-full w-full z-[1]" />
      <Card className="flex w-full z-[2] aspect-[1.618] flex-1 flex-col justify-end rounded-none border-none bg-white p-4 transition-colors duration-300 group-hover:bg-slate-900 dark:bg-background dark:group-hover:bg-network [clip-path:polygon(12px_0,100%_0,100%_calc(100%-12px),calc(100%-12px)_100%,0_100%,0_12px)]">
        <CardTitle className="relative flex items-center justify-between text-slate-900 transition-colors duration-300 group-hover:text-white dark:text-network dark:group-hover:text-background">
          <div className="relative flex items-center">
            <span className="absolute left-0 opacity-0 -translate-x-4 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-hover:animate-[bounce-x_1s_infinite]">
              &gt;
            </span>
            <span className="flex items-center justify-center gap-2 pl-0 transition-all group-hover:pl-6">
              {title}
            </span>
          </div>
        </CardTitle>
      </Card>
    </Link>
  );
};
