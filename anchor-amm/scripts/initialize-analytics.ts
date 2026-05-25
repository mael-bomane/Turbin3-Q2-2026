/**
 * Initialize the singleton Analytics PDA.
 *
 * Usage:
 *   pnpm dlx tsx scripts/initialize-analytics.ts [--admin <pubkey>]
 *
 * Env:
 *   ANCHOR_WALLET   path to fee-payer keypair (default ~/.config/solana/id.json)
 *   RPC_URL         RPC endpoint (default http://127.0.0.1:8899)
 *
 * Requires SDK to be regenerated against the latest IDL:
 *   anchor build && pnpm run sdk:gen
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import {
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
} from "@solana/kit";

import {
  findAnalyticsPda,
  getInitializeAnalyticsInstructionAsync,
} from "../sdk/src/generated";

function parseArgs(argv: string[]): { admin?: Address } {
  const out: { admin?: Address } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--admin" && argv[i + 1]) {
      out.admin = address(argv[i + 1]);
      i++;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const walletPath =
    process.env.ANCHOR_WALLET ?? resolve(homedir(), ".config/solana/id.json");
  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8899";
  const wsUrl = rpcUrl.replace(/^http/, "ws");

  const secret = new Uint8Array(JSON.parse(readFileSync(walletPath, "utf8")));
  const payer = await createKeyPairSignerFromBytes(secret);
  const admin: Address = args.admin ?? payer.address;

  const rpc = createSolanaRpc(rpcUrl);
  const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);

  const [analyticsPda] = await findAnalyticsPda();
  console.log(`payer:     ${payer.address}`);
  console.log(`admin:     ${admin}`);
  console.log(`analytics: ${analyticsPda}`);
  console.log(`rpc:       ${rpcUrl}`);

  const existing = await rpc.getAccountInfo(analyticsPda).send();
  if (existing.value) {
    console.error("analytics already initialized — first-wins, aborting");
    process.exit(1);
  }

  const ix = await getInitializeAnalyticsInstructionAsync({
    payer,
    admin,
  });

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions([ix], m),
  );

  const signed = await signTransactionMessageWithSigners(txMessage);
  const sig = getSignatureFromTransaction(signed);

  const send = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  await send(signed, { commitment: "confirmed" });

  console.log(`ok: ${sig}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
