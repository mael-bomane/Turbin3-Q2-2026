"use client";

import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { ChevronDown } from "lucide-react";
import type { Address } from "@solana/kit";

import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTokenMetadata } from "@/lib/tokenMetadata";
import { truncateAddress } from "@/lib/escrow";
import { cn } from "@/lib/utils";
import { useProgram } from "@/components/providers/Program";

type Props = {
  value: string;
  onChange: (mint: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  filterOut?: string | null;
};

export const PoolTokenCombobox: FC<Props> = ({
  value,
  onChange,
  id,
  placeholder,
  disabled,
  filterOut,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { mints, isLoading } = useProgram();
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedMeta = useTokenMetadata(value || null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = filterOut
      ? mints.filter((m) => String(m) !== filterOut)
      : mints;
    if (!q) return pool;
    return pool.filter((m) => String(m).toLowerCase().includes(q));
  }, [mints, query, filterOut]);

  const triggerLabel = value
    ? selectedMeta.symbol ?? truncateAddress(value)
    : placeholder ?? "select token";
  const triggerInitial = (selectedMeta.symbol ?? value ?? "?")
    .slice(0, 1)
    .toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-full items-center gap-2 border border-input bg-transparent px-3 text-sm shadow-sm",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-network",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {value ? (
          <>
            <Avatar className="h-5 w-5 shrink-0">
              {selectedMeta.icon ? (
                <AvatarImage src={selectedMeta.icon} alt={triggerLabel} />
              ) : null}
              <AvatarFallback className="text-[10px] font-mono">
                {triggerInitial}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "truncate",
                selectedMeta.symbol ? "font-medium" : "font-mono text-xs",
              )}
            >
              {triggerLabel}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">
            {placeholder ?? "select token"}
          </span>
        )}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full border border-input bg-popover text-popover-foreground shadow-md">
          <div className="border-b border-input p-1">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="filter pool tokens"
              className="h-8 font-mono text-xs !rounded-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                loading pools…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                {mints.length === 0 ? "no pools yet" : "no match"}
              </div>
            ) : (
              filtered.map((m) => (
                <PoolTokenOption
                  key={String(m)}
                  mint={m}
                  selected={String(m) === value}
                  onSelect={() => {
                    onChange(String(m));
                    setOpen(false);
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PoolTokenOption: FC<{
  mint: Address;
  selected: boolean;
  onSelect: () => void;
}> = ({ mint, selected, onSelect }) => {
  const meta = useTokenMetadata(mint);
  const label = meta.symbol ?? truncateAddress(mint);
  const initial = (meta.symbol ?? String(mint)).slice(0, 1).toUpperCase();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground",
        selected && "bg-accent/50",
      )}
    >
      <Avatar className="h-5 w-5 shrink-0">
        {meta.icon ? <AvatarImage src={meta.icon} alt={label} /> : null}
        <AvatarFallback className="text-[10px] font-mono">
          {initial}
        </AvatarFallback>
      </Avatar>
      <span className="truncate font-medium">{label}</span>
      <span className="ml-auto shrink-0 truncate font-mono text-[10px] text-muted-foreground">
        {truncateAddress(mint)}
      </span>
    </button>
  );
};
