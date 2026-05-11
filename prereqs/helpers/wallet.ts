import {
  createKeyPairSignerFromBytes,
  sendAndConfirmTransactionFactory,
} from "@solana/kit";
import { rpc, rpcSubscriptions } from "./rpc";

import bw from "../../id.json";

export const signerPromise = createKeyPairSignerFromBytes(new Uint8Array(bw));

export const sendAndConfirm = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions,
});
