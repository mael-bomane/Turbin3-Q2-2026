use crate::error::ErrorCode;
use crate::Escrow;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};

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
    #[account(
        mut,
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
    pub fn quote(&self, amount_a_requested: u64) -> Result<u64> {
        require!(amount_a_requested > 0, ErrorCode::ZeroAmount);
        require!(
            amount_a_requested <= self.escrow.amount_a,
            ErrorCode::InsufficientRemaining
        );

        // amount_b_due = ceil(amount_a_requested * remaining_b / remaining_a)
        let num = (amount_a_requested as u128)
            .checked_mul(self.escrow.amount_b as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        let den = self.escrow.amount_a as u128;
        let amount_b_due = num.div_ceil(den);

        u64::try_from(amount_b_due).map_err(|_| ErrorCode::MathOverflow.into())
    }

    pub fn deposit(&mut self, amount_b: u64) -> Result<()> {
        // send token_b from taker to maker
        let cpi_accounts = TransferChecked {
            from: self.taker_ata_b.to_account_info(),
            to: self.maker_ata_b.to_account_info(),
            mint: self.mint_b.to_account_info(),
            authority: self.taker.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.key(), cpi_accounts);

        transfer_checked(cpi_ctx, amount_b, self.mint_b.decimals)
    }

    pub fn withdraw(&mut self, amount_a: u64) -> Result<()> {
        // send token_a from vault to taker
        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            to: self.taker_ata_a.to_account_info(),
            mint: self.mint_a.to_account_info(),
            authority: self.escrow.to_account_info(),
        };

        let seed = self.escrow.seed.to_le_bytes();
        let seeds = &[
            b"escrow",
            self.escrow.maker.as_ref(),
            seed.as_ref(),
            &[self.escrow.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_ctx =
            CpiContext::new_with_signer(self.token_program.key(), cpi_accounts, signer_seeds);

        transfer_checked(cpi_ctx, amount_a, self.mint_a.decimals)
    }

    pub fn close_vault_and_escrow(&mut self) -> Result<()> {
        let cpi_accounts = CloseAccount {
            account: self.vault.to_account_info(),
            destination: self.maker.to_account_info(),
            authority: self.escrow.to_account_info(),
        };

        let seed = self.escrow.seed.to_le_bytes();
        let seeds = &[
            b"escrow",
            self.escrow.maker.as_ref(),
            seed.as_ref(),
            &[self.escrow.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_ctx =
            CpiContext::new_with_signer(self.token_program.key(), cpi_accounts, signer_seeds);
        close_account(cpi_ctx)?;

        self.escrow.close(self.taker.to_account_info())
    }
}
