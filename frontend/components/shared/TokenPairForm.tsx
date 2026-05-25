"use client";

import type { FC, FormEvent, ReactNode } from "react";
import type { Address } from "@solana/kit";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TokenCombobox } from "@/components/Escrow/TokenCombobox";

type TokenChange = (value: string, token: { decimals: number } | null) => void;

type Side = {
  label: string;
  amount: string;
  onAmountChange: (next: string) => void;
  mint: string;
  onMintChange?: TokenChange;
  mintLocked?: boolean;
  amountReadOnly?: boolean;
  inputId: string;
  mintInputId: string;
  required?: boolean;
  mintSelect?: ReactNode;
};

export type TokenPairFormProps = {
  top: Side;
  bottom: Side;
  middleIcon: ReactNode;
  onMiddleClick?: () => void;
  middleAriaLabel?: string;
  ownerAddress: Address | null;
  submitting: boolean;
  canSubmit: boolean;
  buttonText: string;
  submittingText?: string;
  disconnectedText?: string;
  onSubmit: (e: FormEvent) => void;
  topSlot?: ReactNode;
  bottomSlot?: ReactNode;
  footerSlot?: ReactNode;
};

const SideRow: FC<{ side: Side; ownerAddress: Address | null }> = ({
  side,
  ownerAddress,
}) => (
  <div className="border border-input p-3 space-y-2">
    <Label htmlFor={side.inputId} className="text-xs text-muted-foreground">
      {side.label}
    </Label>
    <div className="flex items-center gap-3">
      <Input
        id={side.inputId}
        type="number"
        step="any"
        min="0"
        placeholder="0.0"
        value={side.amount}
        onChange={(e) => side.onAmountChange(e.target.value)}
        required={side.required ?? true}
        readOnly={side.amountReadOnly}
        className="h-auto border-0 bg-transparent px-0 py-1 text-2xl shadow-none focus-visible:ring-0 md:text-2xl !rounded-none"
      />
      <div className="w-44 shrink-0">
        {side.mintSelect ?? (
          <TokenCombobox
            id={side.mintInputId}
            value={side.mint}
            owner={ownerAddress}
            placeholder="select token"
            disabled={side.mintLocked}
            onChange={(v, token) => side.onMintChange?.(v, token)}
          />
        )}
      </div>
    </div>
  </div>
);

export const TokenPairForm: FC<TokenPairFormProps> = ({
  top,
  bottom,
  middleIcon,
  onMiddleClick,
  middleAriaLabel,
  ownerAddress,
  submitting,
  canSubmit,
  buttonText,
  submittingText = "submitting…",
  disconnectedText = "connect wallet",
  onSubmit,
  topSlot,
  bottomSlot,
  footerSlot,
}) => (
  <form onSubmit={onSubmit} className="space-y-2">
    <SideRow side={top} ownerAddress={ownerAddress} />
    {topSlot}

    <div className="relative h-0">
      <button
        type="button"
        onClick={onMiddleClick}
        aria-label={middleAriaLabel ?? "swap sides"}
        disabled={!onMiddleClick}
        className="absolute left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-default disabled:hover:bg-background disabled:hover:text-muted-foreground"
      >
        {middleIcon}
      </button>
    </div>

    <SideRow side={bottom} ownerAddress={ownerAddress} />
    {bottomSlot}

    <Button
      type="submit"
      variant="network"
      size="lg"
      disabled={submitting || !canSubmit}
      className="w-full hover:text-white"
    >
      {submitting ? submittingText : canSubmit ? buttonText : disconnectedText}
    </Button>

    {footerSlot}
  </form>
);
