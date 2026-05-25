pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("ELvgA3nDX1oSTsCaw5AaGZvuHoWTfpNR3nTRpFPM48ar");

#[program]
pub mod anchor_escrow {
    use super::*;

    #[instruction(discriminator = 0)]
    pub fn make(ctx: Context<Make>, seed: u64, amount_a: u64, amount_b: u64) -> Result<()> {
        ctx.accounts.make(seed, amount_a, amount_b, &ctx.bumps)
    }

    #[instruction(discriminator = 1)]
    pub fn take(ctx: Context<Take>, amount_a_requested: u64) -> Result<()> {
        let amount_b_due = ctx.accounts.quote(amount_a_requested)?;

        ctx.accounts.deposit(amount_b_due)?;
        ctx.accounts.withdraw(amount_a_requested)?;

        // decrement remaining
        ctx.accounts.escrow.amount_a = ctx
            .accounts
            .escrow
            .amount_a
            .checked_sub(amount_a_requested)
            .ok_or(error::ErrorCode::MathOverflow)?;
        ctx.accounts.escrow.amount_b = ctx
            .accounts
            .escrow
            .amount_b
            .checked_sub(amount_b_due)
            .ok_or(error::ErrorCode::MathOverflow)?;

        if ctx.accounts.escrow.amount_a == 0 {
            ctx.accounts.close_vault_and_escrow()?;
        }
        Ok(())
    }

    #[instruction(discriminator = 2)]
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        ctx.accounts.refund()?;
        ctx.accounts.close()
    }
}
