import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

export const rpc = createSolanaRpc("https://api.devnet.solana.com");

export const rpcSubscriptions = createSolanaRpcSubscriptions("wss://api.devnet.solana.com");
