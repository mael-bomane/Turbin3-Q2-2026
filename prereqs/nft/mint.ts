import { generateSigner, signerIdentity } from "@metaplex-foundation/umi";
import { create, mplCore } from "@metaplex-foundation/mpl-core";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { umi, signer } from "../helpers/umi";

umi.use(signerIdentity(signer));

umi.use(mplCore());

(async () => {
  try {
    const metadataUri =
      "https://gateway.irys.xyz/2gCgYo29zNuHubDuajbsRCoKbZHsbjnnQNyfAFeFPHvF";
    const asset = generateSigner(umi);

    //add you nft name and metadata uri
    const tx = await create(umi, {
      asset,
      name: "Meow",
      uri: metadataUri,
    }).sendAndConfirm(umi);

    const signature = base58.deserialize(tx.signature)[0];

    console.log(`signature ${signature} , asset : ${asset.publicKey}`);
  } catch (e) {
    console.log(`errior ${e}`);
  }
})();
//signature 4V6w8xwUoKWXKMj7onHvJUU2hQoZBiMnfHF96CHuqoPGAnDcU5991t6pf2sUXSQjfkeLusDv6ihj9AiuQNH6ms5c , asset : 56JkgqgVWtEjCh96nJtcDqb4usNGJbSzoiCwTipTGp2X
