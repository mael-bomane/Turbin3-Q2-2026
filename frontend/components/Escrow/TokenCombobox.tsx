"use client";

import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTokenMetadata } from "@/lib/tokenMetadata";
import { useUserTokens, type UserToken } from "@/lib/userTokens";
import { truncateAddress } from "@/lib/escrow";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (mint: string, token?: UserToken) => void;
  owner: string | null | undefined;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
};

export const TokenCombobox: FC<Props> = ({
  value,
  onChange,
  owner,
  id,
  placeholder,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: tokens = [], isLoading } = useUserTokens(owner);
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
    if (!q) return tokens;
    return tokens.filter((t) => String(t.mint).toLowerCase().includes(q));
  }, [tokens, query]);

  const trimmedQuery = query.trim();
  const looksLikeMint =
    trimmedQuery.length >= 32 &&
    trimmedQuery.length <= 44 &&
    /^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmedQuery);
  const isCustomMint =
    looksLikeMint && !tokens.some((t) => String(t.mint) === trimmedQuery);

  const triggerLabel = value
    ? selectedMeta.symbol ?? truncateAddress(value)
    : placeholder ?? "select token";
  const triggerInitial = (
    selectedMeta.symbol ??
    value ??
    "?"
  )
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
              placeholder="paste mint or filter"
              className="h-8 font-mono text-xs !rounded-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {!owner ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                connect wallet for suggestions
              </div>
            ) : isLoading ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                loading your tokens…
              </div>
            ) : (
              <>
                {filtered.map((t) => (
                  <TokenOption
                    key={String(t.mint)}
                    token={t}
                    selected={String(t.mint) === value}
                    onSelect={() => {
                      onChange(String(t.mint), t);
                      setOpen(false);
                    }}
                  />
                ))}
                {isCustomMint && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(trimmedQuery);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 border-t border-input px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="text-muted-foreground">use mint</span>
                    <span className="ml-auto font-mono">
                      {truncateAddress(trimmedQuery)}
                    </span>
                  </button>
                )}
                {filtered.length === 0 && !isCustomMint && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    {tokens.length === 0
                      ? "no tokens in wallet — paste a mint above"
                      : "no match — paste a full mint above"}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TokenOption: FC<{
  token: UserToken;
  selected: boolean;
  onSelect: () => void;
}> = ({ token, selected, onSelect }) => {
  const meta = useTokenMetadata(token.mint);
  const label = meta.symbol ?? truncateAddress(token.mint);
  const initial = (meta.symbol ?? String(token.mint)).slice(0, 1).toUpperCase();
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
      <span className="truncate font-mono text-[10px] text-muted-foreground">
        {truncateAddress(token.mint)}
      </span>
      <span className="ml-auto shrink-0 font-mono">{token.uiAmount}</span>
    </button>
  );
};
