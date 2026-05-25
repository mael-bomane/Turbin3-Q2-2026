"use client";

import { useQuery } from "@tanstack/react-query";
import {
  address as toAddress,
  type Address,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { fromBaseUnits, useRpc, WSOL_MINT } from "./escrow";

const TOKEN_2022_PROGRAM = toAddress(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);
const SOL_DECIMALS = 9;

export type UserToken = {
  mint: Address;
  amount: bigint;
  decimals: number;
  uiAmount: string;
  programId: Address;
};

type ParsedTokenAccount = {
  account: {
    data: {
      parsed: {
        info: {
          mint: string;
          tokenAmount: {
            amount: string;
            decimals: number;
            uiAmountString: string;
          };
        };
      };
    };
  };
};

async function fetchProgramTokens(
  rpc: Rpc<SolanaRpcApi>,
  owner: Address,
  programId: Address,
): Promise<UserToken[]> {
  const res = await rpc
    .getTokenAccountsByOwner(
      owner,
      { programId },
      { encoding: "jsonParsed" },
    )
    .send();
  const items = (res.value ?? []) as unknown as ParsedTokenAccount[];
  return items
    .map((it) => {
      const info = it.account.data.parsed.info;
      return {
        mint: toAddress(info.mint),
        amount: BigInt(info.tokenAmount.amount),
        decimals: info.tokenAmount.decimals,
        uiAmount: info.tokenAmount.uiAmountString ?? "0",
        programId,
      };
    })
    .filter((t) => t.amount > BigInt(0));
}

async function fetchNativeSol(
  rpc: Rpc<SolanaRpcApi>,
  owner: Address,
): Promise<bigint> {
  const res = await rpc.getBalance(owner).send();
  return BigInt(res.value);
}

export function useUserTokens(owner: Address | string | null | undefined) {
  const { rpc, rpcUrl } = useRpc();
  const ownerKey = owner ? String(owner) : null;
  return useQuery({
    enabled: !!ownerKey,
    queryKey: ["userTokens", rpcUrl, ownerKey],
    queryFn: async (): Promise<UserToken[]> => {
      const ownerAddr = toAddress(ownerKey!);
      const [legacy, t22, nativeLamports] = await Promise.all([
        fetchProgramTokens(rpc, ownerAddr, TOKEN_PROGRAM_ADDRESS),
        fetchProgramTokens(rpc, ownerAddr, TOKEN_2022_PROGRAM).catch(
          () => [] as UserToken[],
        ),
        fetchNativeSol(rpc, ownerAddr).catch(() => BigInt(0)),
      ]);
      const map = new Map<string, UserToken>();
      for (const t of [...legacy, ...t22]) {
        const k = String(t.mint);
        const prev = map.get(k);
        if (!prev || prev.amount < t.amount) map.set(k, t);
      }
      const wsolKey = String(WSOL_MINT);
      const wrapped = map.get(wsolKey)?.amount ?? BigInt(0);
      const totalSol = nativeLamports + wrapped;
      map.delete(wsolKey);
      const solEntry: UserToken = {
        mint: WSOL_MINT,
        amount: totalSol,
        decimals: SOL_DECIMALS,
        uiAmount: fromBaseUnits(totalSol, SOL_DECIMALS),
        programId: TOKEN_PROGRAM_ADDRESS,
      };
      const rest = Array.from(map.values()).sort((a, b) =>
        a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1,
      );
      return [solEntry, ...rest];
    },
    staleTime: 15_000,
  });
}

export async function fetchMintDecimals(
  rpc: Rpc<SolanaRpcApi>,
  mint: Address,
): Promise<number | null> {
  try {
    const res = await rpc
      .getAccountInfo(mint, { encoding: "jsonParsed" })
      .send();
    const parsed = (res.value as any)?.data?.parsed;
    if (parsed?.type === "mint" && typeof parsed.info?.decimals === "number") {
      return parsed.info.decimals as number;
    }
    return null;
  } catch {
    return null;
  }
}

export function useMintDecimals(mint: Address | string | null | undefined) {
  const { rpc, rpcUrl } = useRpc();
  return useQuery({
    queryKey: ["mintDecimals", rpcUrl, mint ? String(mint) : null],
    queryFn: async () => {
      if (!mint) return null;
      if (String(mint) === String(WSOL_MINT)) return SOL_DECIMALS;
      return fetchMintDecimals(rpc, toAddress(String(mint)));
    },
    enabled: !!mint,
    staleTime: Infinity,
  });
}
