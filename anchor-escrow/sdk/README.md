# @trib3/anchor-escrow-sdk

TypeScript SDK for the [anchor-escrow](https://github.com/mael-bomane/Turbin3-Q2-2026/tree/main/anchor-escrow) Solana program. Codama-generated client built on [`@solana/kit`](https://github.com/anza-xyz/kit).

Program address: `ELvgA3nDX1oSTsCaw5AaGZvuHoWTfpNR3nTRpFPM48ar`

## Install

```bash
pnpm add @trib3/anchor-escrow-sdk @solana/kit
# or
npm install @trib3/anchor-escrow-sdk @solana/kit
```

`@solana/kit` is a peer dependency.

## What's exported

- **Instructions**: `getMakeInstruction`, `getTakeInstruction`, `getRefundInstruction` (plus `*Async` variants that auto-derive PDAs)
- **Accounts**: `Escrow` type, `fetchEscrow`, `decodeEscrow`
- **PDAs**: `findEscrowPda`
- **Program**: `ANCHOR_ESCROW_PROGRAM_ADDRESS`
- **Errors**: decoded program error enum

## Usage

```ts
import {
  getMakeInstructionAsync,
  ANCHOR_ESCROW_PROGRAM_ADDRESS,
} from "@trib3/anchor-escrow-sdk";
import { createSolanaRpc, address } from "@solana/kit";

const rpc = createSolanaRpc("https://api.devnet.solana.com");

const ix = await getMakeInstructionAsync({
  maker,                  // TransactionSigner
  mintA: address("..."),
  mintB: address("..."),
  seed: 1n,
  amountADeposited: 1_000_000n,
  amountBRequested: 2_000_000n,
});

// then build + sign + send via @solana/kit
```

Fetch an escrow:

```ts
import { fetchEscrow, findEscrowPda } from "@trib3/anchor-escrow-sdk";

const [escrowPda] = await findEscrowPda({ maker: maker.address, seed: 1n });
const escrow = await fetchEscrow(rpc, escrowPda);
console.log(escrow.data);
```

## License

MIT
