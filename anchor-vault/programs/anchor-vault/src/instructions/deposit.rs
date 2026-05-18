use crate::state::VaultState;
use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

#[derive(Accounts)]
pub struct Deposit<'info> {
    // signer
    #[account(mut)]
    pub user: Signer<'info>,
    // state (storing bumps)
    #[account(
        seeds = [b"state", user.key().as_ref()],
        bump = state.state_bump
    )]
    pub state: Account<'info, VaultState>,
    // actual lamports vault
    #[account(
        mut,
        seeds = [b"vault", state.key().as_ref()],
        bump = state.vault_bump
    )]
    pub vault: SystemAccount<'info>,
    // needed for initializing pda's and moving lamports ?
    pub system_program: Program<'info, System>,
}

impl<'info> Deposit<'info> {
    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        // accounts needed for cpi
        let cpi_accounts = Transfer {
            from: self.user.to_account_info(),
            to: self.vault.to_account_info(),
        };
        // context for cpi
        let cpi_ctx = CpiContext::new(System::id(), cpi_accounts);
        // actual transfer
        transfer(cpi_ctx, amount)
    }
}
