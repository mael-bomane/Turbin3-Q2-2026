use crate::state::VaultState;
use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"state", user.key().as_ref()],
        bump
    )]
    pub state: Account<'info, VaultState>,
    #[account(
        mut,
        seeds = [b"vault", state.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Withdraw<'info> {
    pub fn withdraw(&mut self, amount: u64, vault_bump: u8) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.user.to_account_info(),
        };

        let state_key = self.state.to_account_info().key();
        let seeds = &[b"vault".as_ref(), state_key.as_ref(), &[vault_bump]];

        let signer_seeds = &[&seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(System::id(), cpi_accounts, signer_seeds);
        transfer(cpi_ctx, amount)
    }
}
