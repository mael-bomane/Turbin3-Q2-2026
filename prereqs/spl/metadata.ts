import { publicKey, signerIdentity } from "@metaplex-foundation/umi";

import {
  createMetadataAccountV3,
  CreateMetadataAccountV3InstructionAccounts,
  CreateMetadataAccountV3InstructionArgs,
  DataV2Args,
} from "@metaplex-foundation/mpl-token-metadata";
import bs58 from "bs58";

import { umi, signer } from "../helpers/umi";

const mint = publicKey("AE1iquKa5BQydPUDLRNsvbEpm7PDEoBJvGtPVa1qZwqM");

umi.use(signerIdentity(signer));

(async () => {
  try {
    const accounts: CreateMetadataAccountV3InstructionAccounts = {
      mint,
      mintAuthority: signer,
    };

    //change the metadata
    const data: DataV2Args = {
      name: "TRIB3 COIN",
      symbol: "TRIB3",
      uri: "https://raw.githubusercontent.com/mael-bomane/Turbin3-Q2-2026/main/prereqs/spl/metadata.json",
      sellerFeeBasisPoints: 1,
      creators: null,
      collection: null,
      uses: null,
    };

    const args: CreateMetadataAccountV3InstructionArgs = {
      data,
      isMutable: true,
      collectionDetails: null,
    };
    const tx = createMetadataAccountV3(umi, {
      ...accounts,
      ...args,
    });

    const result = await tx.sendAndConfirm(umi);
    console.log("signature: ", bs58.encode(Buffer.from(result.signature)));
  } catch (error) {
    console.log("error", error);
  }
})();

// 43ttSnN9qaVi8TDcWwBZo5mUbfKDXY8d1N7exdJojJxV7qjKuwXoEh7qASXbFU4QFrAEFzZvcmWpRch434hSVNLN
// signature:  4WJhUtEtVRgFCM9bF76Rfgp2kySG6AFauCsfjjKRUNA3wavQ8DQwbKgSE9nNh54PyXL7dcBqD5ptycXQ5CfuMpxW