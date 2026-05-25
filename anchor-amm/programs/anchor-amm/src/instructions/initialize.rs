use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{constants::ANALYTICS_SEED, error::AmmError, state::Analytics, Config};

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub mint_x: Box<Account<'info, Mint>>,
    pub mint_y: Box<Account<'info, Mint>>,
    #[account(
        init,
        payer = payer,
        seeds = [b"lp", config.key.as_ref()],
        bump,
        mint::decimals = 6,
        mint::authority = config,
    )]
    pub mint_lp: Box<Account<'info, Mint>>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint_x,
        associated_token::authority = config,
    )]
    pub vault_x: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint_y,
        associated_token::authority = config,
    )]
    pub vault_y: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        payer = payer,
        seeds = [b"config", seed.to_le_bytes().as_ref()],
        bump,
        space = Config::DISCRIMINATOR.len() + Config::INIT_SPACE,
    )]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut,
        seeds = [ANALYTICS_SEED],
        bump = analytics.bump,
    )]
    pub analytics: Box<Account<'info, Analytics>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(
        &mut self,
        seed: u64,
        fee: u16,
        bumps: InitializeBumps,
    ) -> Result<()> {
        require!(fee <= 10_000, AmmError::FeePercentErr);

        self.config.set_inner(Config {
            seed,
            mint_x: self.mint_x.key(),
            mint_y: self.mint_y.key(),
            fee,
            locked: false,
            activated: false,
            config_bump: bumps.config,
            lp_bump: bumps.mint_lp,
        });

        self.analytics.pairs_created = self
            .analytics
            .pairs_created
            .checked_add(1)
            .ok_or(AmmError::Overflow)?;

        Ok(())
    }
}
