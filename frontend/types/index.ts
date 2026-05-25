export * from "./config";

export type Collection = {
  name: string;
  image?: string;
  floorPrice: number;
  change1d: number;
  change7d: number;
  volume1d: number;
  volume7d: number;
  owners: number;
  supply: number;
};

export type Project = {
  name: string;
  description: string;
  image?: string;
  link?: string;
}

export type Post = {
  slug: string;
  title: string;
  date?: Date;
  blockchain?: "solana" | null;
}

export type Task = {
  id: number
  title: string
  done: boolean
}
