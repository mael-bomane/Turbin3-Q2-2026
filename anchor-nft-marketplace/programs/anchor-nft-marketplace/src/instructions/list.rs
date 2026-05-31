use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::spl_token::native_mint,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use mpl_core::{instructions::TransferV1CpiBuilder, ID as MPL_CORE_ID};

use crate::state::{Listing, Marketplace};

#[derive(Accounts)]
pub struct List<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    /// CHECK: validate during the cpi transfer by mpl-core
    pub asset: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub collection: Option<UncheckedAccount<'info>>,

    #[account(
        init,
        payer = maker,
        space = 8 + Listing::INIT_SPACE,
        seeds = [b"listing", asset.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, Listing>,

    #[account(mut)]
    pub mint: Option<InterfaceAccount<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = maker,
        associated_token::mint = mint,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub user_ata: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    /// CHECK: this can only ever be the mpl-core program
    #[account(
        address = MPL_CORE_ID,
    )]
    pub mpl_core_program: UncheckedAccount<'info>,
}

impl<'info> List<'info> {
    pub fn list(&mut self, price: u64, bumps: &ListBumps) -> Result<()> {
        let wsol = native_mint::ID;
        let mint = self.mint.clone().ok_or(wsol).unwrap().key();
        let decimals = self.mint.clone().ok_or(wsol).unwrap().decimals;
        // create the pda

        self.listing.set_inner(Listing {
            maker: self.maker.key(),
            asset: self.asset.key(),
            mint,
            decimals,
            price,
            bump: bumps.listing,
        });

        // transfer asset ownership
        TransferV1CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(self.collection.as_ref().map(|c| c.as_ref()))
            .payer(&self.maker.to_account_info())
            .authority(Some(&self.maker.to_account_info()))
            .new_owner(&self.listing.to_account_info())
            .system_program(Some(&self.system_program.to_account_info()))
            .invoke()?;

        Ok(())
    }
}
