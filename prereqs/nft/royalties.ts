import { publicKey, signerIdentity } from "@metaplex-foundation/umi";
import { addPlugin, ruleSet } from "@metaplex-foundation/mpl-core";
import { umi, signer } from "../helpers/umi";

umi.use(signerIdentity(signer));

(async () => {
  try {
    await addPlugin(umi, {
      asset: publicKey("56JkgqgVWtEjCh96nJtcDqb4usNGJbSzoiCwTipTGp2X"),
      plugin: {
        type: "Royalties",
        basisPoints: 500, // 5%
        creators: [
          {
            address: publicKey("7sydHcmax59DZJ523tFQEakwkJ3vBDWUE64auHy7yn1N"),
            percentage: 100,
          },
        ],
        ruleSet: ruleSet("None"),
      },
    }).sendAndConfirm(umi);
  } catch (error) {
    console.log(error);
  }
})();
