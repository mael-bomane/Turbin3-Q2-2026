pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("7f96rDy6EdQzb5PbNbgWeYFfSnioRjFekrk2iah6ufzL");

#[program]
pub mod anchor_amm {
    use super::*;

    pub fn initialize_analytics(ctx: Context<InitializeAnalytics>, admin: Pubkey) -> Result<()> {
        ctx.accounts.initialize_analytics(admin, ctx.bumps)
    }

    pub fn initialize(ctx: Context<Initialize>, seed: u64, fee: u16) -> Result<()> {
        ctx.accounts.initialize(seed, fee, ctx.bumps)
    }

    pub fn set_admin(ctx: Context<SetAdmin>, new_admin: Pubkey) -> Result<()> {
        ctx.accounts.set_admin(new_admin)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64, max_x: u64, max_y: u64) -> Result<()> {
        ctx.accounts.deposit(amount, max_x, max_y)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64, min_x: u64, min_y: u64) -> Result<()> {
        ctx.accounts.withdraw(amount, min_x, min_y)
    }

    pub fn swap(ctx: Context<Swap>, is_x: bool, amount_in: u64, min_amount_out: u64) -> Result<()> {
        ctx.accounts.swap(is_x, amount_in, min_amount_out)
    }

    pub fn lock(ctx: Context<Lock>) -> Result<()> {
        ctx.accounts.lock()
    }

    pub fn unlock(ctx: Context<Unlock>) -> Result<()> {
        ctx.accounts.unlock()
    }
}
