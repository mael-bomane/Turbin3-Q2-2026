'use client';

import Image from 'next/image';
import solanaIcon from '@/components/icons/solana.svg';
import { useSolPrice } from '@/components/providers/SolanaProvider';

function formatPrice(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  if (value >= 1) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

type PricePillProps = {
  icon: React.ReactNode;
  price: number | null;
  isLoading: boolean;
};

function PricePill({ icon, price, isLoading }: PricePillProps) {
  return (
    <div className="flex items-center gap-1.5 bg-foreground/5 border border-foreground/10 rounded-full pr-2.5">
      {icon}
      <span className="text-xs font-medium tabular-nums text-foreground">
        {isLoading || price === null ? (
          <span className="inline-block w-12 h-3 bg-foreground/10 rounded animate-pulse" />
        ) : (
          `$${formatPrice(price)}`
        )}
      </span>
    </div>
  );
}

export function SolanaPriceTicker() {
  const { price, loading } = useSolPrice();

  return (
    <div className="hidden sm:flex items-center gap-2">
      <PricePill
        icon={
          <div className="flex items-center justify-center size-6 rounded-full bg-background">
            <Image
              src={solanaIcon}
              alt="SOL"
              width={12}
              height={12}
              className="object-contain"
              loading="eager"
            />
          </div>
        }
        price={price || null}
        isLoading={loading}
      />
    </div>
  );
}
