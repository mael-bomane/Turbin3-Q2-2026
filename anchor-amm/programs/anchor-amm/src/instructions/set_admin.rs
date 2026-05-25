use anchor_lang::prelude::*;

use crate::{constants::ANALYTICS_SEED, error::AmmError, state::Analytics};

#[derive(Accounts)]
pub struct SetAdmin<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [ANALYTICS_SEED],
        bump = analytics.bump,
        has_one = admin @ AmmError::InvalidAuthority,
    )]
    pub analytics: Account<'info, Analytics>,
}

impl<'info> SetAdmin<'info> {
    pub fn set_admin(&mut self, new_admin: Pubkey) -> Result<()> {
        self.analytics.admin = new_admin;
        Ok(())
    }
}
