import { createSignerFromKeypair } from "@metaplex-foundation/umi";
import wallet from "../../id.json";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

export const umi = createUmi("https://api.devnet.solana.com");

export const keypair = umi.eddsa.createKeypairFromSecretKey(
  new Uint8Array(wallet),
);
export const signer = createSignerFromKeypair(umi, keypair);
