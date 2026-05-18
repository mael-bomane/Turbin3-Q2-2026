pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("7FKaY8yTWT7mw3ef7WnnZUbgefef7Z3DoRt7896Njx9F");

#[program]
pub mod anchor_vault_rc {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount, ctx.bumps.vault)
    }

    pub fn close(ctx: Context<Close>) -> Result<()> {
        ctx.accounts.close(ctx.bumps.vault)
    }
}
