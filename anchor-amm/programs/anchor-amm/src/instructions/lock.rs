use anchor_lang::prelude::*;

use crate::{
    constants::ANALYTICS_SEED,
    error::AmmError,
    state::{Analytics, Config},
};

#[derive(Accounts)]
pub struct Lock<'info> {
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

impl<'info> Lock<'info> {
    pub fn lock(&mut self) -> Result<()> {
        require!(
            self.analytics.admin == self.authority.key(),
            AmmError::InvalidAuthority
        );
        require!(!self.config.locked, AmmError::PoolLocked);

        self.config.locked = true;

        if self.config.activated {
            self.analytics.active_pairs = self
                .analytics
                .active_pairs
                .checked_sub(1)
                .ok_or(AmmError::Underflow)?;
        }

        Ok(())
    }
}
