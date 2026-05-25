"use client";

import { useEffect, useState } from "react";
import {
  address as toAddress,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";
import { useRpc } from "./escrow";

export type TokenMeta = {
  symbol: string | null;
  name: string | null;
  icon: string | null;
};

const EMPTY: TokenMeta = { symbol: null, name: null, icon: null };
const TOKEN_2022_PROGRAM = toAddress(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);
const METAPLEX_PROGRAM = toAddress(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);
const TOKEN_METADATA_EXTENSION = 19;

const cache = new Map<string, TokenMeta>();
const inflight = new Map<string, Promise<TokenMeta>>();

async function fetchJupiter(mint: string): Promise<TokenMeta> {
  try {
    const res = await fetch(
      `https://lite-api.jup.ag/tokens/v2/search?query=${mint}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as Array<{
      id: string;
      symbol?: string;
      name?: string;
      icon?: string;
    }>;
    const hit = Array.isArray(data) ? data.find((t) => t.id === mint) : null;
    if (!hit) return EMPTY;
    return {
      symbol: hit.symbol ?? null,
      name: hit.name ?? null,
      icon: hit.icon ?? null,
    };
  } catch {
    return EMPTY;
  }
}

function readBorshString(view: DataView, data: Uint8Array, off: number): { value: string; nextOff: number } | null {
  if (off + 4 > data.length) return null;
  const len = view.getUint32(off, true);
  if (len > 1024 || off + 4 + len > data.length) return null;
  const bytes = data.subarray(off + 4, off + 4 + len);
  return {
    value: new TextDecoder("utf-8", { fatal: false })
      .decode(bytes)
      .replace(/\0+$/, "")
      .trim(),
    nextOff: off + 4 + len,
  };
}

function decodeMetaplex(data: Uint8Array): { name: string; symbol: string; uri: string } | null {
  if (data.length < 66 || data[0] !== 4) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const name = readBorshString(view, data, 65);
  if (!name) return null;
  const symbol = readBorshString(view, data, name.nextOff);
  if (!symbol) return null;
  const uri = readBorshString(view, data, symbol.nextOff);
  if (!uri) return null;
  return { name: name.value, symbol: symbol.value, uri: uri.value };
}

function decodeToken2022Metadata(
  data: Uint8Array,
): { name: string; symbol: string; uri: string } | null {
  // 0..82 = base mint; 165 = account_type (1 = Mint); 166+ = TLV
  if (data.length < 166 || data[165] !== 1) return null;
  let off = 166;
  while (off + 4 <= data.length) {
    const type = data[off] | (data[off + 1] << 8);
    const length = data[off + 2] | (data[off + 3] << 8);
    off += 4;
    if (off + length > data.length) return null;
    if (type === TOKEN_METADATA_EXTENSION) {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const start = off + 32 + 32; // skip update_auth + mint
      const name = readBorshString(view, data, start);
      if (!name) return null;
      const symbol = readBorshString(view, data, name.nextOff);
      if (!symbol) return null;
      const uri = readBorshString(view, data, symbol.nextOff);
      if (!uri) return null;
      return { name: name.value, symbol: symbol.value, uri: uri.value };
    }
    off += length;
  }
  return null;
}

async function findMetaplexPda(mint: Address): Promise<Address> {
  const enc = getAddressEncoder();
  const [pda] = await getProgramDerivedAddress({
    programAddress: METAPLEX_PROGRAM,
    seeds: [
      new TextEncoder().encode("metadata"),
      enc.encode(METAPLEX_PROGRAM),
      enc.encode(mint),
    ],
  });
  return pda;
}

async function fetchOnChain(
  rpc: Rpc<SolanaRpcApi>,
  mint: Address,
): Promise<{ name: string; symbol: string; uri: string } | null> {
  const acc = await rpc.getAccountInfo(mint, { encoding: "base64" }).send();
  if (acc.value) {
    const owner = String(acc.value.owner);
    if (owner === String(TOKEN_2022_PROGRAM)) {
      const data = Uint8Array.from(
        Buffer.from((acc.value.data as [string, string])[0], "base64"),
      );
      const inline = decodeToken2022Metadata(data);
      if (inline) return inline;
    }
  }
  try {
    const pda = await findMetaplexPda(mint);
    const meta = await rpc.getAccountInfo(pda, { encoding: "base64" }).send();
    if (!meta.value) return null;
    const data = Uint8Array.from(
      Buffer.from((meta.value.data as [string, string])[0], "base64"),
    );
    return decodeMetaplex(data);
  } catch {
    return null;
  }
}

async function resolveOffChainImage(uri: string): Promise<string | null> {
  if (!uri) return null;
  try {
    const res = await fetch(uri, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.startsWith("image/")) return uri;
    const json = (await res.json()) as Record<string, unknown>;
    return (
      (json.image as string | undefined) ??
      (json.logoURI as string | undefined) ??
      null
    );
  } catch {
    return null;
  }
}

async function fetchMeta(
  rpc: Rpc<SolanaRpcApi>,
  mint: string,
): Promise<TokenMeta> {
  const jup = await fetchJupiter(mint);
  if (jup.icon) return jup;

  const onChain = await fetchOnChain(rpc, toAddress(mint));
  if (!onChain) return jup;

  const icon = jup.icon ?? (await resolveOffChainImage(onChain.uri));
  return {
    symbol: onChain.symbol || jup.symbol,
    name: onChain.name || jup.name,
    icon,
  };
}

export function useTokenMetadata(
  mint: Address | string | null | undefined,
): TokenMeta & { loading: boolean } {
  const { rpc } = useRpc();
  const key = mint ? String(mint) : null;
  const [meta, setMeta] = useState<TokenMeta>(
    key ? cache.get(key) ?? EMPTY : EMPTY,
  );
  const [loading, setLoading] = useState(!!key && !cache.has(key));

  useEffect(() => {
    if (!key) {
      setMeta(EMPTY);
      setLoading(false);
      return;
    }
    if (cache.has(key)) {
      setMeta(cache.get(key)!);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const promise =
      inflight.get(key) ??
      fetchMeta(rpc, key).then((m) => {
        cache.set(key, m);
        inflight.delete(key);
        return m;
      });
    inflight.set(key, promise);
    promise.then((m) => {
      if (!cancelled) {
        setMeta(m);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key, rpc]);

  return { ...meta, loading };
}
