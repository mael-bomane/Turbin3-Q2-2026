# anchor-amm upgrade log

Logical path followed to ship the `transfer_checked` refactor to devnet.

## 1. Rebuild

```bash
cd anchor-amm
anchor build
```

Compiled clean. One unused-import warning (`CurveError` in `deposit.rs`) — cleaned later.

## 2. Run tests

```bash
anchor test
```

Result: 2 passing (`initialize`, `deposit`), 2 failing (`withdraw`, `swap`). Both fail at `Transaction simulation failed` with no program logs surfaced by the SolanaError wrapper.

## 3. Surface program logs

The thrown `SolanaError` carries `e.context` (sim response), which includes `logs`. Patched `send()` in `tests/anchor-amm.ts` to log `e.context` on failure, using a JSON replacer for `bigint` so `JSON.stringify` doesn't throw.

```ts
try {
  await sendAndConfirm(signed as any, { commitment: "confirmed" });
} catch (e: any) {
  console.error("ctx:", JSON.stringify(
    e?.context,
    (_, v) => typeof v === "bigint" ? v.toString() : v,
    2,
  ));
  throw e;
}
```

## 4. Diagnose

Captured logs:

```
Program log: Instruction: TransferChecked
Program log: Error: owner does not match
... failed: custom program error: 0x4
```

`0x4` from the SPL Token program = `OwnerMismatch`. The authority passed to `transfer_checked` did not own the source account.

Root cause: `withdraw_tokens` had `from`/`to` reversed — pointing user → vault while signing with the `config` PDA. For a vault-to-user transfer the source must be the vault (owned by the PDA).

Second bug in `swap.rs`: `self.withdraw_tokens(is_x, ...)` used the input-token flag. A swap pays in token X and receives token Y, so the withdraw side needs `!is_x`.

## 5. Fix

`programs/anchor-amm/src/instructions/withdraw.rs` — swap `from`/`to` in both branches of `withdraw_tokens`:

```rust
true  => (self.vault_x.to_account_info(), self.user_x.to_account_info(), ...),
false => (self.vault_y.to_account_info(), self.user_y.to_account_info(), ...),
```

`programs/anchor-amm/src/instructions/swap.rs` — same `from`/`to` flip in `withdraw_tokens`, plus invert the flag at the call site:

```rust
self.deposit_tokens(is_x, swap_result.deposit)?;
self.withdraw_tokens(!is_x, swap_result.withdraw)
```

## 6. Re-test

```bash
anchor build
anchor test --skip-build
```

All 4 tests pass.

Reverted the debug logger in `send()` and dropped the unused `CurveError` import.

## 7. Pre-deploy checks

Confirm devnet target and authority:

```bash
solana config get                 # RPC URL: devnet
solana address                    # 7sydHcmax59DZJ523tFQEakwkJ3vBDWUE64auHy7yn1N
solana balance --url devnet       # 13.87 SOL
solana program show 7f96rDy6EdQzb5PbNbgWeYFfSnioRjFekrk2iah6ufzL --url devnet
#   Authority: 7sydHcmax59DZJ523tFQEakwkJ3vBDWUE64auHy7yn1N  (matches)
#   Data Length: 304312 bytes
```

Local-only addition to [Anchor.toml](Anchor.toml):

```toml
[programs.devnet]
anchor_amm = "7f96rDy6EdQzb5PbNbgWeYFfSnioRjFekrk2iah6ufzL"
```

## 8. Upgrade program

```bash
solana program deploy \
  --url devnet \
  --program-id target/deploy/anchor_amm-keypair.json \
  target/deploy/anchor_amm.so
```

Result:
- Program Id: `7f96rDy6EdQzb5PbNbgWeYFfSnioRjFekrk2iah6ufzL`
- Tx: `5cNQ2NGe39EjbEV32yXqtipzjCHJayf18hQrF8buXJmAFME8isrNbnXErXDKgxAwee8y9Zf66DK9xkradjSRBrgT`
- New data length: 308336 bytes
- Cost: ~0.03 SOL (upgrade writes the diff, not full rent)

## 9. Upgrade on-chain IDL

```bash
anchor idl upgrade \
  --provider.cluster devnet \
  --filepath target/idl/anchor_amm.json \
  7f96rDy6EdQzb5PbNbgWeYFfSnioRjFekrk2iah6ufzL
```

Keeps the IDL account at the canonical PDA in sync with the new program binary so clients fetching IDL via `Program.fetchIdl` see the current interface.

## Verify

```bash
solana program show 7f96rDy6EdQzb5PbNbgWeYFfSnioRjFekrk2iah6ufzL --url devnet
# Last Deployed In Slot bumped, Data Length matches the new .so size.
```

Optionally run the test suite against devnet by pointing the RPC URL in the test file at devnet to smoke-test the live program.
