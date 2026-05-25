use anchor_lang::prelude::*;

use crate::{constants::ANALYTICS_SEED, state::Analytics};

#[derive(Accounts)]
pub struct InitializeAnalytics<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        seeds = [ANALYTICS_SEED],
        bump,
        space = Analytics::DISCRIMINATOR.len() + Analytics::INIT_SPACE,
    )]
    pub analytics: Account<'info, Analytics>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitializeAnalytics<'info> {
    pub fn initialize_analytics(
        &mut self,
        admin: Pubkey,
        bumps: InitializeAnalyticsBumps,
    ) -> Result<()> {
        self.analytics.set_inner(Analytics {
            admin,
            tvl_wsol: 0,
            volume_wsol: 0,
            swaps: 0,
            pairs_created: 0,
            active_pairs: 0,
            created_at: Clock::get()?.unix_timestamp,
            bump: bumps.analytics,
        });
        Ok(())
    }
}
