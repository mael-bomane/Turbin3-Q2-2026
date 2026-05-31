use anchor_lang::{
    prelude::*,
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, MintTo},
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use mpl_core::{instructions::TransferV1CpiBuilder, ID as MPL_CORE_ID};

use crate::state::{Listing, Marketplace};

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,

    /// CHECK:
    #[account(mut)]
    pub maker: UncheckedAccount<'info>,

    #[account(
        seeds = [b"marketplace", marketplace.name.as_str().as_bytes()],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = payment_mint,
        associated_token::authority = marketplace,
    )]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: validate during the cpi transfer by mpl-core
    pub asset: UncheckedAccount<'info>,

    /// CHECK:
    #[account(mut)]
    pub collection: Option<UncheckedAccount<'info>>,

    #[account(
        mut,
        close = maker,
        seeds = [b"listing", asset.key().as_ref()],
        bump = listing.bump,
        has_one = maker,
        has_one = asset,
    )]
    pub listing: Account<'info, Listing>,

    #[account(
        mut,
        address = listing.mint
    )]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = taker,
        associated_token::token_program = token_program,
    )]
    pub payment_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"rewards", marketplace.key().as_ref()],
        bump = marketplace.rewards_bump,
        mint::decimals = 6,
        mint::authority = marketplace,
    )]
    pub rewards_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = rewards_mint,
        associated_token::authority = taker,
        associated_token::token_program = token_program,
    )]
    pub taker_rewards_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    /// CHECK: this can only ever be the mpl-core program
    #[account(
        address = MPL_CORE_ID,
    )]
    pub mpl_core_program: UncheckedAccount<'info>,
}

impl<'info> Buy<'info> {
    pub fn send_payment(&mut self) -> Result<()> {
        let price = self.listing.price;
        // safe math
        let fee = (price as u128)
            .checked_mul(self.marketplace.fee as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;

        let maker_amount = price.checked_sub(fee).unwrap();

        transfer_checked(
            CpiContext::new(
                self.system_program.to_account_info(),
                TransferChecked {
                    from: self.taker.to_account_info(),
                    mint: self.payment_mint.to_account_info(),
                    authority: self.taker.to_account_info(),
                    to: self.maker.to_account_info(),
                },
            ),
            maker_amount,
            self.payment_mint.decimals,
        )?;

        transfer_checked(
            CpiContext::new(
                self.system_program.to_account_info(),
                TransferChecked {
                    from: self.taker.to_account_info(),
                    mint: self.payment_mint.to_account_info(),
                    authority: self.taker.to_account_info(),
                    to: self.treasury.to_account_info(),
                },
            ),
            fee,
            self.payment_mint.decimals,
        )?;

        Ok(())
    }

    pub fn receive_nft(&mut self) -> Result<()> {
        let asset_key = self.asset.key();
        let bump = self.listing.bump;
        let seeds: &[&[u8]] = &[b"listing", asset_key.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        // transfer asset ownership
        TransferV1CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(self.collection.as_ref().map(|c| c.as_ref()))
            .payer(&self.taker.to_account_info())
            .authority(Some(&self.listing.to_account_info()))
            .new_owner(&self.taker.to_account_info())
            .system_program(Some(&self.system_program.to_account_info()))
            .invoke_signed(signer_seeds)?;

        Ok(())
    }

    pub fn receive_rewards(&mut self) -> Result<()> {
        let seeds: &[&[u8]] = &[
            b"marketplace",
            self.marketplace.name.as_str().as_bytes(),
            &[self.marketplace.bump],
        ];
        let signer_seeds = &[seeds];

        mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                MintTo {
                    mint: self.rewards_mint.to_account_info(),
                    to: self.taker_rewards_ata.to_account_info(),
                    authority: self.marketplace.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;

        Ok(())
    }
}
