use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::Escrow;

#[derive(Accounts)]
#[instruction(seed: u64, amount_a: u64, amount_b: u64)]
pub struct Make<'info> {
    // maker is the signer
    #[account(mut)]
    pub maker: Signer<'info>,
    // mint A, currency the maker gives
    #[account(
        mint::token_program = token_program
    )]
    pub mint_a: Box<InterfaceAccount<'info, Mint>>,
    // maker's mint A ata
    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = maker,
        associated_token::token_program = token_program
    )]
    pub mint_a_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    // mint B , currency the maker gets from taker
    #[account(
        mint::token_program = token_program
    )]
    pub mint_b: Box<InterfaceAccount<'info, Mint>>,
    // state account
    #[account(
        init,
        payer = maker,
        seeds = [b"escrow", maker.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump,
        space = Escrow::DISCRIMINATOR.len() + Escrow::INIT_SPACE
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer = maker,
        associated_token::mint = mint_a,
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Make<'info> {
    // initialize escrow pda
    pub fn make(
        &mut self,
        seed: u64,
        amount_a: u64,
        amount_b: u64,
        bumps: &MakeBumps,
    ) -> Result<()> {
        self.escrow.set_inner(Escrow {
            seed,
            maker: self.maker.key(),
            mint_a: self.mint_a.key(),
            amount_a,
            mint_b: self.mint_b.key(),
            amount_b,
            created_at: Clock::get()?.unix_timestamp,
            bump: bumps.escrow,
        });

        let transfer_accounts = TransferChecked {
            from: self.mint_a_ata.to_account_info(),
            to: self.vault.to_account_info(),
            mint: self.mint_a.to_account_info(),
            authority: self.maker.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(*self.token_program.key, transfer_accounts);

        transfer_checked(cpi_ctx, amount_a, self.mint_a.decimals)
    }
}
