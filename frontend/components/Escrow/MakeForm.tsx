"use client";

import { useState, type FC, type FormEvent } from "react";
import { ArrowDown } from "lucide-react";
import { toast } from "sonner";
import {
  address as toAddress,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase58Decoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
  type TransactionSendingSigner,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getMakeInstructionAsync } from "@trib3/anchor-escrow-sdk";

import { useRpc, WSOL_MINT, toBaseUnits } from "@/lib/escrow";
import { fetchMintDecimals } from "@/lib/userTokens";
import { TokenPairForm } from "@/components/shared/TokenPairForm";

const WSOL_DECIMALS = 9;

type Props = {
  signer: TransactionSendingSigner | null;
  onCreated?: () => void;
};

export const MakeForm: FC<Props> = ({ signer, onCreated }) => {
  const { rpc } = useRpc();

  const [mintA, setMintA] = useState<string>("");
  const [mintADecimals, setMintADecimals] = useState<number | null>(null);
  const [amountA, setAmountA] = useState("");
  const [mintB, setMintB] = useState<string>(String(WSOL_MINT));
  const [mintBDecimals, setMintBDecimals] = useState<number | null>(
    WSOL_DECIMALS,
  );
  const [amountB, setAmountB] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ownerAddress = signer?.address ?? null;

  const handleFlip = () => {
    setMintA(mintB);
    setMintADecimals(mintBDecimals);
    setAmountA(amountB);
    setMintB(mintA);
    setMintBDecimals(mintADecimals);
    setAmountB(amountA);
  };

  const resolveDecimals = async (
    mint: string,
    cached: number | null,
  ): Promise<number> => {
    if (cached !== null) return cached;
    const fetched = await fetchMintDecimals(rpc, toAddress(mint));
    if (fetched === null) throw new Error(`mint ${mint.slice(0, 8)}… not found`);
    return fetched;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!signer) {
      toast.error("connect wallet first");
      return;
    }
    if (!mintA.trim() || !mintB.trim()) {
      toast.error("select both tokens");
      return;
    }
    if (mintA.trim() === mintB.trim()) {
      toast.error("mint A and mint B must differ");
      return;
    }
    setSubmitting(true);
    try {
      const decA = await resolveDecimals(mintA.trim(), mintADecimals);
      const decB = await resolveDecimals(mintB.trim(), mintBDecimals);

      const seed = BigInt(Math.floor(Math.random() * 2 ** 32));
      const ix = await getMakeInstructionAsync({
        maker: signer,
        mintA: toAddress(mintA.trim()),
        mintB: toAddress(mintB.trim()),
        seed,
        amountA: toBaseUnits(amountA, decA),
        amountB: toBaseUnits(amountB, decB),
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });

      const { value: latest } = await rpc.getLatestBlockhash().send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(signer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
        (m) => appendTransactionMessageInstructions([ix], m),
      );

      const sigBytes = await signAndSendTransactionMessageWithSigners(message);
      const sig = getBase58Decoder().decode(sigBytes);
      toast.success(`offer created — ${sig.slice(0, 8)}…`);
      setMintA("");
      setMintADecimals(null);
      setAmountA("");
      setMintB(String(WSOL_MINT));
      setMintBDecimals(WSOL_DECIMALS);
      setAmountB("");
      onCreated?.();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "failed to create offer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TokenPairForm
      ownerAddress={ownerAddress}
      submitting={submitting}
      canSubmit={!!signer}
      buttonText="create offer"
      submittingText="creating…"
      disconnectedText="connect wallet"
      onSubmit={handleSubmit}
      middleIcon={<ArrowDown className="h-4 w-4" />}
      onMiddleClick={handleFlip}
      middleAriaLabel="swap give/get"
      top={{
        label: "sell",
        amount: amountA,
        onAmountChange: setAmountA,
        mint: mintA,
        onMintChange: (v, token) => {
          setMintA(v);
          setMintADecimals(token?.decimals ?? null);
        },
        inputId: "amountA",
        mintInputId: "mintA",
      }}
      bottom={{
        label: "buy",
        amount: amountB,
        onAmountChange: setAmountB,
        mint: mintB,
        onMintChange: (v, token) => {
          setMintB(v);
          setMintBDecimals(token?.decimals ?? null);
        },
        inputId: "amountB",
        mintInputId: "mintB",
      }}
    />
  );
};
