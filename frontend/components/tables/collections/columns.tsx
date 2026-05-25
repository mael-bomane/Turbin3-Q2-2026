"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Collection } from "@/types";

export const columns: ColumnDef<Collection>[] = [
  // {
  //   id: "rank",
  //   header: "#",
  //   cell: ({ row }) => row.index + 1,
  //   size: 40,
  // },
  {
    accessorKey: "name",
    header: () => <div className="pl-4 text-left">collection</div>,
    cell: ({ row }) => (
      <span className="flex items-center gap-3 pl-4">
        <Avatar className="h-8 w-8">
          <AvatarImage src={row.original.image} />
          <AvatarFallback>{row.original.name[0]}</AvatarFallback>
        </Avatar>
        <span className="font-medium">{row.original.name}</span>
      </span>
    ),
  },
  {
    accessorKey: "floorPrice",
    header: "floor",
    cell: ({ row }) => (
      <span>{row.getValue<number>("floorPrice").toFixed(2)}</span>
    ),
  },
  {
    accessorKey: "change1d",
    header: "1d Δ",
    cell: ({ row }) => {
      const value = row.getValue<number>("change1d");
      const isPositive = value >= 0;
      return (
        <span className={isPositive ? "text-green-500" : "text-red-500"}>
          {isPositive ? "+" : ""}
          {value.toFixed(2)}%
        </span>
      );
    },
  },
  {
    accessorKey: "change7d",
    header: "7d Δ",
    cell: ({ row }) => {
      const value = row.getValue<number>("change7d");
      const isPositive = value >= 0;
      return (
        <span className={isPositive ? "text-green-500" : "text-red-500"}>
          {isPositive ? "+" : ""}
          {value.toFixed(2)}%
        </span>
      );
    },
  },
  {
    accessorKey: "volume1d",
    header: "1d vol",
    cell: ({ row }) => (
      <span>{row.getValue<number>("volume1d").toFixed(2)}</span>
    ),
  },
  {
    accessorKey: "volume7d",
    header: "7d vol",
    cell: ({ row }) => (
      <span>{row.getValue<number>("volume7d").toFixed(2)}</span>
    ),
  },
  {
    accessorKey: "owners",
    header: "Owners",
    cell: ({ row }) => (
      <span>{row.getValue<number>("owners").toLocaleString()}</span>
    ),
  },
  {
    accessorKey: "supply",
    header: "Supply",
    cell: ({ row }) => (
      <span>{row.getValue<number>("supply").toLocaleString()}</span>
    ),
  },
];
