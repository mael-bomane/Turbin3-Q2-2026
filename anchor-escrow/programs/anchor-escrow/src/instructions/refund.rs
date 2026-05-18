use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};

use crate::state::Escrow;

// maker
// mint_a
// maker_ata_a
// escrow
// vault

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(
        mint::token_program = token_program
    )]
    mint_a: Box<InterfaceAccount<'info, Mint>>,
    // maker's mint A ata
    #[account(
        init_if_needed, // maker could have accidentally closed account
        payer = maker,
        associated_token::mint = mint_a,
        associated_token::authority = maker,
        associated_token::token_program = token_program
    )]
    pub mint_a_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    // escrow we're closing
    #[account(
        mut, // has to be mutable, we're closing
        close = maker, // close macro
        seeds = [b"escrow", escrow.maker.as_ref(), escrow.seed.to_le_bytes().as_ref()],
        bump = escrow.bump,
        has_one = maker, // important check
        has_one = mint_a, // important check
    )]
    pub escrow: Account<'info, Escrow>,
    // program ata vault
    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    // required because we touch pda's
    pub system_program: Program<'info, System>,
    // required for spl tokens
    pub token_program: Interface<'info, TokenInterface>,
    // required for ata's
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Refund<'info> {
    pub fn refund(&mut self) -> Result<()> {
        // send token_a from vault to taker
        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            to: self.mint_a_ata.to_account_info(),
            mint: self.mint_a.to_account_info(),
            authority: self.escrow.to_account_info(),
        };

        // signer seeds
        let seed = self.escrow.seed.clone().to_le_bytes();

        let seeds = &[
            b"escrow",
            self.escrow.maker.as_ref(),
            seed.as_ref(),
            // &self.escrow.seed.to_le_bytes().as_ref(),
            &[self.escrow.bump],
        ];

        let signer_seeds = &[&seeds[..]];

        let cpi_ctx =
            CpiContext::new_with_signer(self.token_program.key(), cpi_accounts, signer_seeds);

        transfer_checked(cpi_ctx, self.escrow.amount_a, self.mint_a.decimals)
    }

    pub fn close(&mut self) -> Result<()> {
        let cpi_accounts = CloseAccount {
            account: self.vault.to_account_info(),
            destination: self.maker.to_account_info(),
            authority: self.escrow.to_account_info(),
        };
        // signer seeds
        let seed = self.escrow.seed.clone().to_le_bytes();

        let seeds = &[
            b"escrow",
            self.escrow.maker.as_ref(),
            seed.as_ref(),
            // &self.escrow.seed.to_le_bytes().as_ref(),
            &[self.escrow.bump],
        ];

        let signer_seeds = &[&seeds[..]];

        let cpi_ctx =
            CpiContext::new_with_signer(self.token_program.key(), cpi_accounts, signer_seeds);

        close_account(cpi_ctx)
    }
}
