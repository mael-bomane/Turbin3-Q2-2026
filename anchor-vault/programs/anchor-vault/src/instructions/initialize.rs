use crate::state::VaultState;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    // signer
    #[account(mut)]
    pub user: Signer<'info>,
    // state (storing bumps)
    #[account(
        init,
        payer = user,
        seeds = [b"state", user.key().as_ref()],
        bump,
        space = 8 + VaultState::INIT_SPACE
    )]
    pub state: Account<'info, VaultState>,
    // actual lamports vault
    #[account(
        seeds = [b"vault", state.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,
    // needed for initializing pda's and moving lamports ?
    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(&mut self, bumps: &InitializeBumps) -> Result<()> {
        // save data to state
        self.state.vault_bump = bumps.vault;
        self.state.state_bump = bumps.state;

        Ok(())
    }
}
