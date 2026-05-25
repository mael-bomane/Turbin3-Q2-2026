"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { HermesClient, type PriceUpdate } from "@pythnetwork/hermes-client";

const HERMES_ENDPOINT = "https://hermes.pyth.network";

const SOL_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

type SolanaContextType = {
  price: number;
  loading: boolean;
  error: string | null;
};

const SolPriceContext = createContext<SolanaContextType | undefined>(undefined);

export function SolanaProvider({ children }: { children: ReactNode }) {
  const [price, setPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<HermesClient | null>(null);
  const streamRef = useRef<Awaited<
    ReturnType<HermesClient["getPriceUpdatesStream"]>
  > | null>(null);
  const unmountedRef = useRef(false);

  const handleUpdate = useCallback((update: PriceUpdate) => {
    const parsed = update.parsed;
    if (!parsed || parsed.length === 0) return;
    const item = parsed[0];
    const multiplier = Math.pow(10, item.price.expo);
    setPrice(parseFloat(item.price.price) * multiplier);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    if (!clientRef.current) {
      clientRef.current = new HermesClient(HERMES_ENDPOINT);
    }
    const client = clientRef.current;
    let cancelled = false;

    (async () => {
      try {
        const es = await client.getPriceUpdatesStream([SOL_FEED_ID], {
          parsed: true,
          allowUnordered: false,
        });
        if (cancelled || unmountedRef.current) {
          es.close();
          return;
        }
        streamRef.current = es;
        es.onmessage = (event: MessageEvent) => {
          if (unmountedRef.current) return;
          try {
            const data: PriceUpdate = JSON.parse(event.data as string);
            handleUpdate(data);
          } catch {
            // skip malformed frame
          }
        };
        es.onerror = () => {
          if (unmountedRef.current) return;
          setError("lost connection to Pyth price stream");
        };
      } catch (err) {
        if (cancelled || unmountedRef.current) return;
        setError(err instanceof Error ? err.message : "failed to connect to Pyth");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unmountedRef.current = true;
      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
      }
    };
  }, [handleUpdate]);

  return (
    <SolPriceContext.Provider value={{ price, loading, error }}>
      {children}
    </SolPriceContext.Provider>
  );
}

export function useSolPrice() {
  const context = useContext(SolPriceContext);
  if (!context) {
    throw new Error("useSolPrice must be used within a SolanaProvider");
  }
  return context;
}
