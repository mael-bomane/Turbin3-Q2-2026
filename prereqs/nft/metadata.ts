import { signerIdentity } from "@metaplex-foundation/umi";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { umi, signer } from "../helpers/umi";

(async () => {
  umi.use(
    irysUploader({
      address: "https://devnet.irys.xyz/",
    }),
  );

  umi.use(signerIdentity(signer));
  try {
    //change the image uri to your image uri obtained from nft_image.ts
    const image =
      "https://gateway.irys.xyz/6jMip1RKJ7qtfXZBuuYraSCfPah4Q7dnXFSjCPbg1F6N";

    //json scheme : https://www.metaplex.com/docs/smart-contracts/core/json-schema
    //change the metadata
    const metadata = {
      name: "Meow",
      description: "CAT",
      image,
      attributes: [
        { trait_type: "Rarity", value: "Legendary" },
        { trait_type: "Job", value: "Full-Time Unemployed" },
      ],

      properties: {
        files: [
          {
            type: "image/gif",
            uri: image,
          },
        ],
        category: "image",
      },
    };

    const myUri = await umi.uploader.uploadJson(metadata);
    console.log(`metadata uri: ${myUri} `);
  } catch (error) {
    console.log("error", error);
  }
})();
// metadata uri: https://gateway.irys.xyz/2gCgYo29zNuHubDuajbsRCoKbZHsbjnnQNyfAFeFPHvF
