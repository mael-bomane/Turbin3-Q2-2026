import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({
  weight: "800",
  subsets: ["latin"],
});

import type { FC } from "react";

type Props = {
  title: string;
  className?: string;
};

export const Title: FC<Props> = ({ title, className }) => {
  return (
    <h1
      className={cn(
        inter.className,
        "py-4 text-2xl md:text-5xl tracking-[-0.03em] bg-[length:300%_300%] bg-[linear-gradient(60deg,#BBFF99,#99FFDD,#99BAFF,#DD99FF,#FF99BA,#FFDD99)] bg-clip-text text-transparent animate-gradient",
        className,
      )}
    >
      {title}
    </h1>
  );
};
