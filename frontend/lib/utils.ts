import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const toSol = (lamports: bigint) => {
  return Number(lamports) / 1e9;
};

export const ellipsis = (str: string, n = 6) => {
  if (str) {
    return `${str.slice(0, n)}...${str.slice(str.length - n)}`;
  }
  return "";
};

export const formatNumber = (x: number) => {
  return new Intl.NumberFormat("en-US", {}).format(x);
};

export const formatDate = (date: Date | undefined): string => {
  if (!date) return "";

  return date
    .toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    .toLocaleLowerCase();
};

export const timeAgo = (d: Date) => {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 6e4),
    h = Math.floor(m / 60),
    D = Math.floor(h / 24);
  return D
    ? `${D}d ${h % 24}h ${m % 60}m ago`
    : h
      ? `${h}h ${m % 60}m ago`
      : `${m}m ago`;
};
