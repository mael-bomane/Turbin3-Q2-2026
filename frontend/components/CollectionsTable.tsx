"use client";

import type { FC } from "react";
import { DataTable } from "./tables/collections/data-table";
import { columns } from "./tables/collections/columns";
import type { Collection } from "@/types";
import { cn } from "@/lib/utils";

const mockCollections: Collection[] = [
  {
    name: "Azuki",
    floorPrice: 0.72,
    change1d: 5.18,
    change7d: 6.01,
    volume1d: 11.9,
    volume7d: 95.58,
    owners: 4454,
    supply: 10000,
  },
  {
    name: "NORMIES",
    floorPrice: 0.09,
    change1d: 8.43,
    change7d: 114.92,
    volume1d: 48.37,
    volume7d: 182.9,
    owners: 1694,
    supply: 8310,
  },
  {
    name: "Human Resources",
    floorPrice: 0.04,
    change1d: 91.41,
    change7d: 221.83,
    volume1d: 13.57,
    volume7d: 27.36,
    owners: 909,
    supply: 10000,
  },
  {
    name: "ASMBrain",
    floorPrice: 0.01,
    change1d: 71.47,
    change7d: 71.47,
    volume1d: 0.06,
    volume7d: 0.09,
    owners: 2805,
    supply: 9394,
  },
  {
    name: "God Hates NFTees",
    floorPrice: 0.05,
    change1d: -1.2,
    change7d: 22.68,
    volume1d: 0.24,
    volume7d: 1.78,
    owners: 1779,
    supply: 5022,
  },
];

type Props = {
  className?: string;
};

export const CollectionsTable: FC<Props> = ({ className }) => {
  return (
    <section
      className={cn(
        "w-full mx-auto flex grow flex-col items-center z-[2]",
        className,
      )}
    >
      <DataTable columns={columns} data={mockCollections} />
    </section>
  );
};
