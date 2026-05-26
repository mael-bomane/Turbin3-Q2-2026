# @trib3/anchor-amm-sdk

TypeScript SDK for the [anchor-amm](https://github.com/mael-bomane/Turbin3-Q2-2026/tree/main/anchor-amm) Solana program. Codama-generated client built on [`@solana/kit`](https://github.com/anza-xyz/kit).

Constant-product AMM with LP mint, admin controls, lock/unlock, and on-chain analytics.

Program address: `7f96rDy6EdQzb5PbNbgWeYFfSnioRjFekrk2iah6ufzL`

## Install

```bash
pnpm add @trib3/anchor-amm-sdk @solana/kit
# or
npm install @trib3/anchor-amm-sdk @solana/kit
```

`@solana/kit` is a peer dependency.

## What's exported

- **Instructions**:
  - Pool lifecycle: `getInitializeInstruction`, `getInitializeAnalyticsInstruction`
  - Liquidity: `getDepositInstruction`, `getWithdrawInstruction`
  - Trading: `getSwapInstruction`
  - Admin: `getSetAdminInstruction`, `getLockInstruction`, `getUnlockInstruction`
  - `*Async` variants auto-derive PDAs
- **Accounts**: `Config`, `Analytics` types + `fetch*` / `decode*` helpers
- **PDAs**: `findConfigPda`, `findMintLpPda`, `findAnalyticsPda`
- **Program**: `ANCHOR_AMM_PROGRAM_ADDRESS`
- **Errors**: decoded program error enum

## Usage

Initialize a pool:

```ts
import {
  getInitializeInstructionAsync,
  ANCHOR_AMM_PROGRAM_ADDRESS,
} from "@trib3/anchor-amm-sdk";
import { createSolanaRpc, address } from "@solana/kit";

const rpc = createSolanaRpc("https://api.devnet.solana.com");

const ix = await getInitializeInstructionAsync({
  admin,                  // TransactionSigner
  mintX: address("..."),
  mintY: address("..."),
  seed: 1n,
  fee: 30,                // bps
  authority: address("..."),
});
```

Swap:

```ts
import { getSwapInstructionAsync } from "@trib3/anchor-amm-sdk";

const ix = await getSwapInstructionAsync({
  user,
  mintX: address("..."),
  mintY: address("..."),
  seed: 1n,
  amountIn: 1_000_000n,
  minAmountOut: 990_000n,
  xToY: true,
});
```

Fetch pool config:

```ts
import { fetchConfig, findConfigPda } from "@trib3/anchor-amm-sdk";

const [configPda] = await findConfigPda({ seed: 1n });
const config = await fetchConfig(rpc, configPda);
console.log(config.data);
```

## License

MIT
