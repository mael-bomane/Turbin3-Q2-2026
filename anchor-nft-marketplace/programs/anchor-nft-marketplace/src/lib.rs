#![allow(unexpected_cfgs, deprecated, ambiguous_glob_reexports)]

use anchor_lang::prelude::*;

mod instructions;
mod state;

use instructions::*;

declare_id!("CCV1gCPJXVEFxu5UAv5kcchUgcPptBPGkT7QbTEwCN84");

#[program]
pub mod anchor_nft_marketplace {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, name: String, fee: u16) -> Result<()> {
        ctx.accounts.initialize(name, fee, &ctx.bumps)
    }

    pub fn list(ctx: Context<List>, price: u64) -> Result<()> {
        ctx.accounts.list(price, &ctx.bumps)
    }

    pub fn delist(ctx: Context<Delist>) -> Result<()> {
        ctx.accounts.delist()
    }

    pub fn buy(ctx: Context<Buy>) -> Result<()> {
        ctx.accounts.send_payment()?;
        ctx.accounts.receive_nft()?;
        ctx.accounts.receive_rewards()?;
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        ctx.accounts.claim(&ctx.bumps)
    }
}
