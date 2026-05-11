import { createGenericFile, signerIdentity } from "@metaplex-foundation/umi";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { readFile } from "fs/promises";
import { umi, signer } from "../helpers/umi";

(async () => {
  umi.use(
    irysUploader({
      address: "https://devnet.irys.xyz/",
    }),
  );

  umi.use(signerIdentity(signer));
  try {
    //chanege image path to your image path
    const image = await readFile("./image.gif");

    //change the image name and mime type
    const file = createGenericFile(image, "image.gif", {
      contentType: "image/gif",
    });

    const [myUri] = await umi.uploader.upload([file]);
    console.log("Your image URI: ", myUri);
  } catch (error) {
    console.log(error);
  }
})();

// Your image URI:  https://gateway.irys.xyz/6jMip1RKJ7qtfXZBuuYraSCfPah4Q7dnXFSjCPbg1F6N
