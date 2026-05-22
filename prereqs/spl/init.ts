import {
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createTransactionMessage,
  getSignatureFromTransaction,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import {
  getInitializeMintInstruction,
  getMintSize,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { rpc } from "../../prereqs/helpers/rpc";
import { sendAndConfirm, signerPromise } from "../../prereqs/helpers/wallet";
import { getCreateAccountInstruction } from "@solana-program/system";
import vanity from "../../vanity.json";

(async () => {
  try {
    const signer = await signerPromise;

    const mint = await createKeyPairSignerFromBytes(new Uint8Array(vanity));

    const space = BigInt(getMintSize());

    const rent = await rpc.getMinimumBalanceForRentExemption(space).send();

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const txMsg = appendTransactionMessageInstructions(
      [
        getCreateAccountInstruction({
          payer: signer,
          newAccount: mint,
          lamports: rent,
          space,
          programAddress: TOKEN_PROGRAM_ADDRESS,
        }),

        getInitializeMintInstruction({
          mint: mint.address,
          decimals: 6,
          mintAuthority: signer.address,
        }),
      ],
      setTransactionMessageLifetimeUsingBlockhash(
        latestBlockhash,
        setTransactionMessageFeePayerSigner(
          signer,
          createTransactionMessage({ version: 0 }),
        ),
      ),
    );

    const tx = await signTransactionMessageWithSigners(txMsg);

    assertIsTransactionWithBlockhashLifetime(tx);

    const signature = getSignatureFromTransaction(tx);

    await sendAndConfirm(tx, { commitment: "confirmed" });

    console.log(
      `mint address: ${mint.address}. Transaction Signature: ${signature}`,
    );
  } catch (error) {
    console.log(error);
  }
})();

// AE1iquKa5BQydPUDLRNsvbEpm7PDEoBJvGtPVa1qZwqM
// TrxzN5MPyhVBJZ65UYpnTPA4mwrW2Uo9KgELu1mz9dc
