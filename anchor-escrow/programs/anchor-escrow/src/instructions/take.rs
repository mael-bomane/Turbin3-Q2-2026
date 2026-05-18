use crate::Escrow;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};

// taker
// maker
// taker_ata_a (receives funds)
// taker_ata_b (pays to maker)
// maker_ata_b (receives funds from taker)
// escrow
// associated token program
//
#[derive(Accounts)]
pub struct Take<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    #[account(mut)]
    pub maker: SystemAccount<'info>,
    #[account(
        mint::token_program = token_program
    )]
    mint_a: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mint::token_program = token_program
    )]
    mint_b: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = mint_a,
        associated_token::authority = taker,
        associated_token::token_program = token_program
    )]
    taker_ata_a: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = mint_b,
        associated_token::authority = taker,
        associated_token::token_program = token_program
    )]
    taker_ata_b: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = mint_b,
        associated_token::authority = maker,
        associated_token::token_program = token_program
    )]
    maker_ata_b: Box<InterfaceAccount<'info, TokenAccount>>,
    // state account
    #[account(
        mut,
        close = taker,
        seeds = [b"escrow", escrow.maker.as_ref(), escrow.seed.to_le_bytes().as_ref()],
        bump = escrow.bump,
        has_one = mint_a,
        has_one = mint_b,
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(mut,
        associated_token::mint = mint_a,
        associated_token::authority = escrow,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Take<'info> {
    pub fn deposit(&mut self) -> Result<()> {
        // send token_b from taker to maker
        let cpi_accounts = TransferChecked {
            from: self.taker_ata_b.to_account_info(),
            to: self.maker_ata_b.to_account_info(),
            mint: self.mint_b.to_account_info(),
            authority: self.taker.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.key(), cpi_accounts);

        transfer_checked(cpi_ctx, self.escrow.amount_b, self.mint_b.decimals)
    }

    pub fn withdraw(&mut self) -> Result<()> {
        // send token_a from vault to taker
        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            to: self.taker_ata_a.to_account_info(),
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
