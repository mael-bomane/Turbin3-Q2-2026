pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("4mxrKT9nTNKSoH13CZXbZdx6qxH7jxANEQfQeXozv1pP");

#[program]
pub mod anchor_vault {
    use super::*;

    // initialize
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps)
    }

    // deposit
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)
    }

    // withdraw
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)
    }

    // close
    pub fn close(ctx: Context<Close>) -> Result<()> {
        ctx.accounts.close()
    }
}
