// Bench: stored bump (Variant B = anchor_vault) vs recomputed bump
// (Variant A = anchor_vault_rc). Measures CU per ix across many
// users so bump-value distribution is sampled.

use {
    anchor_lang::{
        solana_program::instruction::Instruction, system_program, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::Message,
    solana_pubkey::Pubkey,
    solana_rent::Rent,
    solana_signer::Signer,
    solana_transaction::Transaction,
};

const N_USERS: usize = 64;
const DEPOSIT_AMOUNT: u64 = 100_000_000;
const WITHDRAW_AMOUNT: u64 = 25_000_000;

#[derive(Default, Clone)]
struct Samples {
    initialize: Vec<u64>,
    deposit: Vec<u64>,
    withdraw: Vec<u64>,
    close: Vec<u64>,
    state_bump: Vec<u8>,
    vault_bump: Vec<u8>,
}

fn summarize(name: &str, v: &[u64]) -> (u64, u64, u64) {
    let min = *v.iter().min().unwrap();
    let max = *v.iter().max().unwrap();
    let mean = v.iter().sum::<u64>() / v.len() as u64;
    println!(
        "  {name:<11}  min={min:<6}  mean={mean:<6}  max={max:<6}  n={}",
        v.len()
    );
    (min, mean, max)
}

fn setup() -> LiteSVM {
    let mut svm = LiteSVM::new();
    svm.add_program(
        anchor_vault::id(),
        include_bytes!("../../../target/deploy/anchor_vault.so"),
    )
    .unwrap();
    svm.add_program(
        anchor_vault_rc::id(),
        include_bytes!("../../../target/deploy/anchor_vault_rc.so"),
    )
    .unwrap();
    svm
}

fn run_variant_b(svm: &mut LiteSVM, payer: &Keypair) -> (u64, u64, u64, u64, u8, u8) {
    let user = payer.pubkey();
    let pid = anchor_vault::id();
    let (state, state_bump) = Pubkey::find_program_address(&[b"state", user.as_ref()], &pid);
    let (vault, vault_bump) = Pubkey::find_program_address(&[b"vault", state.as_ref()], &pid);
    let system_program = system_program::ID;

    let init_ix = Instruction {
        program_id: pid,
        accounts: anchor_vault::accounts::Initialize {
            user,
            state,
            vault,
            system_program,
        }
        .to_account_metas(None),
        data: anchor_vault::instruction::Initialize {}.data(),
    };
    let init_cu = send(svm, payer, init_ix);

    let dep_ix = Instruction {
        program_id: pid,
        accounts: anchor_vault::accounts::Deposit {
            user,
            state,
            vault,
            system_program,
        }
        .to_account_metas(None),
        data: anchor_vault::instruction::Deposit {
            amount: DEPOSIT_AMOUNT,
        }
        .data(),
    };
    let dep_cu = send(svm, payer, dep_ix);

    let wd_ix = Instruction {
        program_id: pid,
        accounts: anchor_vault::accounts::Withdraw {
            user,
            state,
            vault,
            system_program,
        }
        .to_account_metas(None),
        data: anchor_vault::instruction::Withdraw {
            amount: WITHDRAW_AMOUNT,
        }
        .data(),
    };
    let wd_cu = send(svm, payer, wd_ix);

    let cl_ix = Instruction {
        program_id: pid,
        accounts: anchor_vault::accounts::Close {
            user,
            state,
            vault,
            system_program,
        }
        .to_account_metas(None),
        data: anchor_vault::instruction::Close {}.data(),
    };
    let cl_cu = send(svm, payer, cl_ix);

    (init_cu, dep_cu, wd_cu, cl_cu, state_bump, vault_bump)
}

fn run_variant_a(svm: &mut LiteSVM, payer: &Keypair) -> (u64, u64, u64, u64, u8, u8) {
    let user = payer.pubkey();
    let pid = anchor_vault_rc::id();
    let (state, state_bump) = Pubkey::find_program_address(&[b"state", user.as_ref()], &pid);
    let (vault, vault_bump) = Pubkey::find_program_address(&[b"vault", state.as_ref()], &pid);
    let system_program = system_program::ID;

    let init_ix = Instruction {
        program_id: pid,
        accounts: anchor_vault_rc::accounts::Initialize {
            user,
            state,
            vault,
            system_program,
        }
        .to_account_metas(None),
        data: anchor_vault_rc::instruction::Initialize {}.data(),
    };
    let init_cu = send(svm, payer, init_ix);

    let dep_ix = Instruction {
        program_id: pid,
        accounts: anchor_vault_rc::accounts::Deposit {
            user,
            state,
            vault,
            system_program,
        }
        .to_account_metas(None),
        data: anchor_vault_rc::instruction::Deposit {
            amount: DEPOSIT_AMOUNT,
        }
        .data(),
    };
    let dep_cu = send(svm, payer, dep_ix);

    let wd_ix = Instruction {
        program_id: pid,
        accounts: anchor_vault_rc::accounts::Withdraw {
            user,
            state,
            vault,
            system_program,
        }
        .to_account_metas(None),
        data: anchor_vault_rc::instruction::Withdraw {
            amount: WITHDRAW_AMOUNT,
        }
        .data(),
    };
    let wd_cu = send(svm, payer, wd_ix);

    let cl_ix = Instruction {
        program_id: pid,
        accounts: anchor_vault_rc::accounts::Close {
            user,
            state,
            vault,
            system_program,
        }
        .to_account_metas(None),
        data: anchor_vault_rc::instruction::Close {}.data(),
    };
    let cl_cu = send(svm, payer, cl_ix);

    (init_cu, dep_cu, wd_cu, cl_cu, state_bump, vault_bump)
}

fn send(svm: &mut LiteSVM, payer: &Keypair, ix: Instruction) -> u64 {
    let msg = Message::new(&[ix], Some(&payer.pubkey()));
    let bh = svm.latest_blockhash();
    let tx = Transaction::new(&[payer], msg, bh);
    let meta = svm.send_transaction(tx).expect("tx ok");
    meta.compute_units_consumed
}

#[test]
fn bench_stored_vs_recompute() {
    let mut svm = setup();
    let mut a = Samples::default();
    let mut b = Samples::default();

    for _ in 0..N_USERS {
        let kp = Keypair::new();
        svm.airdrop(&kp.pubkey(), 5_000_000_000).unwrap();

        let (i, d, w, c, sb, vb) = run_variant_b(&mut svm, &kp);
        b.initialize.push(i);
        b.deposit.push(d);
        b.withdraw.push(w);
        b.close.push(c);
        b.state_bump.push(sb);
        b.vault_bump.push(vb);

        let (i, d, w, c, sb, vb) = run_variant_a(&mut svm, &kp);
        a.initialize.push(i);
        a.deposit.push(d);
        a.withdraw.push(w);
        a.close.push(c);
        a.state_bump.push(sb);
        a.vault_bump.push(vb);
    }

    println!("\n=== bump distribution (variant B program-id) ===");
    println!(
        "  state_bump min={} max={} mean={}",
        b.state_bump.iter().min().unwrap(),
        b.state_bump.iter().max().unwrap(),
        b.state_bump.iter().map(|&x| x as u64).sum::<u64>() / b.state_bump.len() as u64
    );
    println!(
        "  vault_bump min={} max={} mean={}",
        b.vault_bump.iter().min().unwrap(),
        b.vault_bump.iter().max().unwrap(),
        b.vault_bump.iter().map(|&x| x as u64).sum::<u64>() / b.vault_bump.len() as u64
    );

    println!("\n=== bump distribution (variant A program-id) ===");
    println!(
        "  state_bump min={} max={} mean={}",
        a.state_bump.iter().min().unwrap(),
        a.state_bump.iter().max().unwrap(),
        a.state_bump.iter().map(|&x| x as u64).sum::<u64>() / a.state_bump.len() as u64
    );
    println!(
        "  vault_bump min={} max={} mean={}",
        a.vault_bump.iter().min().unwrap(),
        a.vault_bump.iter().max().unwrap(),
        a.vault_bump.iter().map(|&x| x as u64).sum::<u64>() / a.vault_bump.len() as u64
    );

    println!("\n=== Variant B (stored bump) CU ===");
    let b_init = summarize("initialize", &b.initialize);
    let b_dep = summarize("deposit", &b.deposit);
    let b_wd = summarize("withdraw", &b.withdraw);
    let b_cl = summarize("close", &b.close);

    println!("\n=== Variant A (recompute bump) CU ===");
    let a_init = summarize("initialize", &a.initialize);
    let a_dep = summarize("deposit", &a.deposit);
    let a_wd = summarize("withdraw", &a.withdraw);
    let a_cl = summarize("close", &a.close);

    // Rent calc
    let rent = Rent::default();
    let size_b = 8 + 2; // discriminator + 2 stored bumps
    let size_a = 8 + 0;
    let rent_b = rent.minimum_balance(size_b);
    let rent_a = rent.minimum_balance(size_a);
    let extra_bytes = size_b as i64 - size_a as i64;
    let extra_rent = rent_b as i64 - rent_a as i64;

    println!("\n=== Rent (solana-rent default) ===");
    println!("  size variant A (no bumps stored): {size_a} bytes  rent={rent_a} lamports");
    println!("  size variant B (2 bumps stored ): {size_b} bytes  rent={rent_b} lamports");
    println!("  extra bytes: {extra_bytes}   extra rent: {extra_rent} lamports");

    // Break-even table: CU_saved = A_mean - B_mean.
    // Per-call savings come from deposit/withdraw/close (initialize is paid once
    // and stored bumps are written there; recompute saves write but Anchor still
    // computes for `bump` annotation, so initialize CU also differs).
    let lamports_per_cu_cases = [0u64, 1, 100, 10_000];

    println!("\n=== Break-even table (mean CU) ===");
    println!("  per-call CU saved (recompute - stored):");
    let dep_saved = a_dep.1 as i64 - b_dep.1 as i64;
    let wd_saved = a_wd.1 as i64 - b_wd.1 as i64;
    let cl_saved = a_cl.1 as i64 - b_cl.1 as i64;
    let init_saved = a_init.1 as i64 - b_init.1 as i64;
    println!("    initialize: {init_saved}   (one-shot, not amortized)");
    println!("    deposit:    {dep_saved}");
    println!("    withdraw:   {wd_saved}");
    println!("    close:      {cl_saved}   (one-shot)");

    println!("\n  break_even_calls = extra_rent / (CU_saved * lamports_per_CU)");
    for &lpcu in &lamports_per_cu_cases {
        println!("\n  lamports_per_CU = {lpcu}");
        for (label, saved) in [
            ("deposit-only", dep_saved),
            ("withdraw-only", wd_saved),
            ("dep+wd avg", (dep_saved + wd_saved) / 2),
        ] {
            if lpcu == 0 || saved <= 0 {
                println!("    {label:<14} -> break-even never (saved={saved}, lpcu={lpcu})");
                continue;
            }
            let denom = (saved as u64) * lpcu;
            let calls = (extra_rent as u64).div_ceil(denom);
            println!("    {label:<14} saved={saved} CU  break_even_calls={calls}");
        }
    }

    println!("\n=== Final table (markdown) ===");
    println!("| ix         | acct       | bump stored | CU recompute | CU stored | CU saved | extra bytes | extra rent (lamports) | lamports/CU | break-even calls |");
    println!("|------------|------------|-------------|--------------|-----------|----------|-------------|------------------------|-------------|-------------------|");
    let row = |ix: &str, a_mean: u64, b_mean: u64| {
        let saved = a_mean as i64 - b_mean as i64;
        let calls_1 = if saved > 0 {
            ((extra_rent as u64).div_ceil(saved as u64)).to_string()
        } else {
            "n/a".into()
        };
        println!(
            "| {ix:<10} | state+vault | yes (Var B) | {a_mean:<12} | {b_mean:<9} | {saved:<8} | {extra_bytes:<11} | {extra_rent:<22} | 1           | {calls_1} |"
        );
    };
    row("initialize", a_init.1, b_init.1);
    row("deposit", a_dep.1, b_dep.1);
    row("withdraw", a_wd.1, b_wd.1);
    row("close", a_cl.1, b_cl.1);
}

// Empirical crossover: simulate N_USERS independent lifecycles
// (init + M deposit+withdraw pairs) on each variant. Average per-call CU
// across users, then plot cumulative cost (rent + Σ CU*lamports_per_CU)
// and locate the call index at which Variant B (stored) becomes cheaper
// on average than Variant A (recompute).
//
// Note: a *single* user with bump=255 sees Variant A cheaper for all calls
// (recompute first-try beats stored-byte load by ~40 CU). Break-even only
// holds in expectation over the bump distribution, so the test averages.
#[test]
fn confirm_break_even_lifecycle() {
    let mut svm = setup();
    let system_program = system_program::ID;
    let pid_b = anchor_vault::id();
    let pid_a = anchor_vault_rc::id();

    const N_USERS: usize = 32;
    const N_PAIRS: usize = 6;
    let n_amort: usize = 2 * N_PAIRS;

    // per_call_x[k][u] = CU for amortizing ix k of user u (k in 0..2N_PAIRS)
    let mut per_call_a: Vec<Vec<u64>> = vec![Vec::with_capacity(N_USERS); n_amort];
    let mut per_call_b: Vec<Vec<u64>> = vec![Vec::with_capacity(N_USERS); n_amort];
    let mut init_a_cus: Vec<u64> = Vec::with_capacity(N_USERS);
    let mut init_b_cus: Vec<u64> = Vec::with_capacity(N_USERS);

    for _ in 0..N_USERS {
        let payer = Keypair::new();
        svm.airdrop(&payer.pubkey(), 5_000_000_000).unwrap();
        let user = payer.pubkey();

        let (state_b, _) = Pubkey::find_program_address(&[b"state", user.as_ref()], &pid_b);
        let (vault_b, _) = Pubkey::find_program_address(&[b"vault", state_b.as_ref()], &pid_b);
        let init_b = send(&mut svm, &payer, Instruction {
            program_id: pid_b,
            accounts: anchor_vault::accounts::Initialize { user, state: state_b, vault: vault_b, system_program }.to_account_metas(None),
            data: anchor_vault::instruction::Initialize {}.data(),
        });
        init_b_cus.push(init_b);

        let (state_a, _) = Pubkey::find_program_address(&[b"state", user.as_ref()], &pid_a);
        let (vault_a, _) = Pubkey::find_program_address(&[b"vault", state_a.as_ref()], &pid_a);
        let init_a = send(&mut svm, &payer, Instruction {
            program_id: pid_a,
            accounts: anchor_vault_rc::accounts::Initialize { user, state: state_a, vault: vault_a, system_program }.to_account_metas(None),
            data: anchor_vault_rc::instruction::Initialize {}.data(),
        });
        init_a_cus.push(init_a);

        for i in 0..N_PAIRS {
            // unique amounts per iter so per-user signatures differ
            let dep_amt = DEPOSIT_AMOUNT + i as u64;
            let wd_amt = WITHDRAW_AMOUNT + i as u64;

            let dep_b = send(&mut svm, &payer, Instruction {
                program_id: pid_b,
                accounts: anchor_vault::accounts::Deposit { user, state: state_b, vault: vault_b, system_program }.to_account_metas(None),
                data: anchor_vault::instruction::Deposit { amount: dep_amt }.data(),
            });
            let wd_b = send(&mut svm, &payer, Instruction {
                program_id: pid_b,
                accounts: anchor_vault::accounts::Withdraw { user, state: state_b, vault: vault_b, system_program }.to_account_metas(None),
                data: anchor_vault::instruction::Withdraw { amount: wd_amt }.data(),
            });
            per_call_b[2 * i].push(dep_b);
            per_call_b[2 * i + 1].push(wd_b);

            let dep_a = send(&mut svm, &payer, Instruction {
                program_id: pid_a,
                accounts: anchor_vault_rc::accounts::Deposit { user, state: state_a, vault: vault_a, system_program }.to_account_metas(None),
                data: anchor_vault_rc::instruction::Deposit { amount: dep_amt }.data(),
            });
            let wd_a = send(&mut svm, &payer, Instruction {
                program_id: pid_a,
                accounts: anchor_vault_rc::accounts::Withdraw { user, state: state_a, vault: vault_a, system_program }.to_account_metas(None),
                data: anchor_vault_rc::instruction::Withdraw { amount: wd_amt }.data(),
            });
            per_call_a[2 * i].push(dep_a);
            per_call_a[2 * i + 1].push(wd_a);
        }
    }

    let mean = |v: &[u64]| -> u64 { v.iter().sum::<u64>() / v.len() as u64 };
    let mean_init_a = mean(&init_a_cus);
    let mean_init_b = mean(&init_b_cus);
    let mean_per_call_a: Vec<u64> = per_call_a.iter().map(|v| mean(v)).collect();
    let mean_per_call_b: Vec<u64> = per_call_b.iter().map(|v| mean(v)).collect();

    let rent = Rent::default();
    let rent_b = rent.minimum_balance(8 + 2);
    let rent_a = rent.minimum_balance(8);

    println!("\n=== Crossover lifecycle (avg over {N_USERS} users, init + {N_PAIRS} × (dep+wd)) ===");
    println!("  rent up-front:    A={rent_a}  B={rent_b}  (Δ={})", rent_b - rent_a);
    println!("  mean init CU:     A={mean_init_a}  B={mean_init_b}");
    println!("  mean amortizing CU per ix idx:");
    for k in 0..n_amort {
        let kind = if k % 2 == 0 { "dep" } else { "wd " };
        println!("    [{k:>2}] {kind}  A={:<6}  B={:<6}  saved(A-B)={}", mean_per_call_a[k], mean_per_call_b[k], mean_per_call_a[k] as i64 - mean_per_call_b[k] as i64);
    }

    for lpcu in [1u64, 100, 10_000] {
        println!("\n  --- lamports_per_CU = {lpcu} ---");
        println!("  k | cum_cost_A (lamports) | cum_cost_B (lamports) |  B - A  | B cheaper?");
        let mut cum_a: u64 = rent_a + mean_init_a * lpcu;
        let mut cum_b: u64 = rent_b + mean_init_b * lpcu;
        let mut crossover: Option<usize> = None;
        for k in 0..n_amort {
            cum_a += mean_per_call_a[k] * lpcu;
            cum_b += mean_per_call_b[k] * lpcu;
            let diff = cum_b as i64 - cum_a as i64;
            let cheaper = diff < 0;
            if cheaper && crossover.is_none() {
                crossover = Some(k + 1);
            }
            println!(
                "  {:>2} | {cum_a:>21} | {cum_b:>21} | {diff:>7} | {}",
                k + 1,
                if cheaper { "yes" } else { "no" }
            );
        }
        match crossover {
            Some(k) => println!("  -> Variant B cheaper from amortizing ix #{k} onward"),
            None => println!("  -> Variant B never cheaper within {n_amort} ixs"),
        }
        if lpcu == 1 {
            let k = crossover.expect("expected crossover within window at lpcu=1");
            assert!(
                (3..=8).contains(&k),
                "empirical mean crossover {k} far from analytical ~5"
            );
        }
    }
}
