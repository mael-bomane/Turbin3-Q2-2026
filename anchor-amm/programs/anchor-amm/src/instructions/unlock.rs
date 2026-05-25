use anchor_lang::prelude::*;

use crate::{
    constants::ANALYTICS_SEED,
    error::AmmError,
    state::{Analytics, Config},
};

#[derive(Accounts)]
pub struct Unlock<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [ANALYTICS_SEED],
        bump = analytics.bump,
    )]
    pub analytics: Account<'info, Analytics>,
}

impl<'info> Unlock<'info> {
    pub fn unlock(&mut self) -> Result<()> {
        require!(
            self.analytics.admin == self.authority.key(),
            AmmError::InvalidAuthority
        );
        require!(self.config.locked, AmmError::PoolUnlocked);

        self.config.locked = false;

        if self.config.activated {
            self.analytics.active_pairs = self
                .analytics
                .active_pairs
                .checked_add(1)
                .ok_or(AmmError::Overflow)?;
        }

        Ok(())
    }
}
