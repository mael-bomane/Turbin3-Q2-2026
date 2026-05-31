use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use anchor_spl::{associated_token::AssociatedToken, token_interface::{TransferChecked, transfer_checked, Mint, TokenAccount, TokenInterface}};

use crate::state::Marketplace;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct Claim<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        has_one = admin,
        seeds = [b"marketplace", name.as_str().as_bytes()],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        mut,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = marketplace,
    )]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Claim<'info> {
    pub fn claim(&mut self, bumps: &ClaimBumps) -> Result<()> {
        let amount = 0u64;

        // accounts needed for cpi
        let cpi_accounts = TransferChecked {
            from: self.treasury.to_account_info(),
            authority: self.treasury.to_account_info(),
            mint: self.mint.to_account_info(),
            to: self.admin.to_account_info(),
        };


        let seeds = &[
            b"treasury",
            self.marketplace.to_account_info().key.as_ref(),
            &[],
        ];

        let signer_seeds = &[&seeds[..]];
        // context for cpi
        let cpi_ctx = CpiContext::new_with_signer(
            self.system_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );

        transfer_checked(cpi_ctx, amount, self.mint.decimals)
    }
}
