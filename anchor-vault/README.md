# anchor vault — stored vs recomputed PDA bump

classwork for turbin3 q2 2026, tinkering around bumps, CU vs rents.

![anchor-vault](anchor-vault.png)

two programs, same instructions, different bump strategy:

- `anchor-vault` (Variant B): stores `state_bump` + `vault_bump` in `VaultState`. Anchor uses `create_program_address` with stored byte.
- `anchor-vault-rc` (Variant A): empty `VaultState`. Anchor recomputes via `find_program_address` each ix; signer seeds use `ctx.bumps.vault`.

Two tests in [programs/anchor-vault/tests/bench_bumps.rs](programs/anchor-vault/tests/bench_bumps.rs):

1. `bench_stored_vs_recompute` — 64 random users, full lifecycle on both programs. Mean CU per ix.
2. `confirm_break_even_lifecycle` — 32 users × (init + 6 deposit/withdraw pairs). Tracks mean cumulative cost (rent + Σ CU × lamports/CU) per ix index, finds empirical crossover.

CU from `TransactionMetadata.compute_units_consumed`. Rent from `solana_rent::Rent::default()`.

## Results (mean CU, n=64)

| ix | CU recompute | CU stored | CU saved |
|----|----|----|----|
| initialize | 11179 | 11081 | ~0 (noise) |
| deposit    | 9484  | 6550  | **2934** |
| withdraw   | 9573  | 6627  | **2946** |
| close      | 10368 | 7423  | **2945** |

Variant B deposit/withdraw/close CU is constant — stored bump skips the find loop.
Variant A varies with bump value (each fail iter ≈ 1500 CU). Sampled bumps 248–255 here; worst case (bump=0) ≈ 255 × 1500 ≈ 380k CU.

## Rent

| `VaultState` size | bytes | rent (lamports) |
|----|----|----|
| no bumps stored | 8  | 946,560 |
| 2 bumps stored  | 10 | 960,480 |
| **extra**       | **+2** | **+13,920** |

## Break-even (analytical)

```
break_even_calls = extra_rent / (CU_saved * lamports_per_CU)
```

| lamports/CU | break-even calls (deposit/withdraw/close) |
|----|----|
| 0   | never (no CU lamport cost) |
| 1   | **5** |
| 100 | 1 |
| 10k | 1 |

## Break-even (empirical, `confirm_break_even_lifecycle`)

Mean cumulative cost over 32 users at `lpcu=1`:

| amortizing ix # | cum cost A (recompute) | cum cost B (stored) | B − A   | B cheaper? |
|----|----|----|----|----|
| 1  |   968,113 |   978,721 | +10,608 | no |
| 2  |   978,131 |   985,348 |  +7,217 | no |
| 3  |   988,060 |   991,898 |  +3,838 | no |
| 4  |   998,078 |   998,525 |    +447 | no |
| 5  | 1,008,007 | 1,005,075 |  −2,932 | **yes** |
| 6  | 1,018,025 | 1,011,702 |  −6,323 | yes |

Crossover at **ix #5**, matches analytical `13920 / 2940 ≈ 4.73`. At `lpcu=100` or `10k`, B wins from ix #1.

## Caveats

- **Mean is not per-user.** Bump distribution is skewed: ~50% of users get bump=255. For those, recompute hits on the first try (~1500 CU for `find_program_address`) and is actually ~40 CU **cheaper per ix** than the stored-byte read+verify path. Stored bump only wins in expectation across users, or when the user happens to draw a low bump.
- **Worst case dominates planning.** Variant A worst case (bump=0) ≈ 255 × 1500 ≈ 380k CU. Stored bump caps this. If your ix has tight CU headroom (CPIs, account loads), stored bump is a safety floor, not just an optimization.
- **Rent is recoverable on close.** The +13,920 lamports isn't burnt — it's a deposit returned at close. In that framing stored bump is free post-recovery.
- **Initialize gains nothing.** Write-2-bytes ≈ find-PDA cost (within noise).

## Run

```sh
cargo build-sbf
cargo test --test bench_bumps --release -- --nocapture
```

Or via anchor (runs both bench + e2e):

```sh
anchor test --skip-local-validator --skip-deploy
```
