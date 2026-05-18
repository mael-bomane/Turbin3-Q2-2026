use {
    anchor_lang::{
        solana_program::{instruction::Instruction, msg},
        system_program, AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::Message,
    solana_pubkey::Pubkey,
    solana_signer::Signer,
    solana_transaction::Transaction,
};

fn setup() -> (LiteSVM, Keypair) {
    let program_id = anchor_vault::id();
    let payer = Keypair::new();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/anchor_vault.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();
    (svm, payer)
}

#[test]
fn test_e2e() {
    let (mut svm, payer) = setup();

    let user = payer.pubkey();
    let (state, state_bump) =
        Pubkey::find_program_address(&[b"state", user.as_ref()], &anchor_vault::id());

    let (vault, vault_bump) =
        Pubkey::find_program_address(&[b"vault", state.as_ref()], &anchor_vault::id());

    let system_program = system_program::ID;

    // Initialize
    let init_ix = Instruction {
        program_id: anchor_vault::id(),
        accounts: anchor_vault::accounts::Initialize {
            user,
            state,
            vault,
            system_program,
        }
        .to_account_metas(None),
        data: anchor_vault::instruction::Initialize {}.data(),
    };

    let message = Message::new(&[init_ix], Some(&payer.pubkey()));

    let recent_blockhash = svm.latest_blockhash();
    let transaction = Transaction::new(&[&payer], message, recent_blockhash);
    let init_tx = svm.send_transaction(transaction).unwrap();

    msg!(
        "Initialize transaction success !\n Signature {}",
        init_tx.signature
    );

    let state_account = svm.get_account(&state).unwrap();
    let state_account_struct =
        anchor_vault::state::VaultState::try_deserialize(&mut state_account.data.as_ref()).unwrap();

    assert_eq!(state_account_struct.state_bump, state_bump);
    assert_eq!(state_account_struct.vault_bump, vault_bump);

    // Deposit

    let deposit_amount: u64 = 1_000_000_000;

    let deposit_ix = Instruction {
        program_id: anchor_vault::id(),
        accounts: anchor_vault::accounts::Deposit {
            user,
            state,
            vault,
            system_program,
        }
        .to_account_metas(None),
        data: anchor_vault::instruction::Deposit {
            amount: deposit_amount,
        }
        .data(),
    };
    let message = Message::new(&[deposit_ix], Some(&payer.pubkey()));

    let recent_blockhash = svm.latest_blockhash();
    let transaction = Transaction::new(&[&payer], message, recent_blockhash);
    let deposit_tx = svm.send_transaction(transaction).unwrap();
    msg!(
        "Deposit transaction success !\n Signature {}",
        deposit_tx.signature
    );

    let vault_balance_after_deposit = svm.get_balance(&vault).unwrap();

    assert_eq!(vault_balance_after_deposit, deposit_amount);

    msg!("Vault Balance : {}", vault_balance_after_deposit);

    // Withdraw

    let withdraw_amount: u64 = 500_000_000;

    let withdraw_ix = Instruction {
        program_id: anchor_vault::id(),
        accounts: anchor_vault::accounts::Withdraw {
            user,
            state,
            vault,
            system_program,
        }
        .to_account_metas(None),
        data: anchor_vault::instruction::Withdraw {
            amount: withdraw_amount,
        }
        .data(),
    };
    let message = Message::new(&[withdraw_ix], Some(&payer.pubkey()));

    let recent_blockhash = svm.latest_blockhash();
    let transaction = Transaction::new(&[&payer], message, recent_blockhash);
    let withdraw_tx = svm.send_transaction(transaction).unwrap();
    msg!(
        "Initialize transaction success !\n Signature {}",
        withdraw_tx.signature
    );

    let vault_balance_after_withdraw = svm.get_balance(&vault).unwrap();

    assert_eq!(vault_balance_after_withdraw, withdraw_amount);

    msg!("Vault Balance : {}", vault_balance_after_deposit);

    // Close

    let close_amount = svm.get_balance(&vault).unwrap();

    let close_ix = Instruction {
        program_id: anchor_vault::id(),
        accounts: anchor_vault::accounts::Close {
            user,
            state,
            vault,
            system_program,
        }
        .to_account_metas(None),
        data: anchor_vault::instruction::Close {}.data(),
    };
    let message = Message::new(&[close_ix], Some(&payer.pubkey()));

    let recent_blockhash = svm.latest_blockhash();
    let transaction = Transaction::new(&[&payer], message, recent_blockhash);
    let close_tx = svm.send_transaction(transaction).unwrap();
    msg!(
        "Close transaction success !\n Signature {}",
        close_tx.signature
    );

    assert!(svm.get_account(&vault).is_none());
    assert!(svm.get_account(&state).is_none());

    let user_balance_after_close = svm.get_balance(&user).unwrap();

    assert!(user_balance_after_close > close_amount);

    msg!("User Balance : {}", user_balance_after_close);
}
