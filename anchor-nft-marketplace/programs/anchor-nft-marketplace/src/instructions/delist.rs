use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};
use mpl_core::{instructions::TransferV1CpiBuilder, ID as MPL_CORE_ID};

use crate::state::{Listing, Marketplace};

#[derive(Accounts)]
pub struct Delist<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
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

    pub system_program: Program<'info, System>,

    /// CHECK: this can only ever be the mpl-core program
    #[account(
        address = MPL_CORE_ID,
    )]
    pub mpl_core_program: UncheckedAccount<'info>,
}

impl<'info> Delist<'info> {
    pub fn delist(&mut self) -> Result<()> {
        // prepare signer seeds
        let asset_key = self.asset.key();
        let bump = self.listing.bump;
        let seeds: &[&[u8]] = &[b"listing", asset_key.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        // transfer asset ownership
        TransferV1CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(self.collection.as_ref().map(|c| c.as_ref()))
            .payer(&self.maker.to_account_info())
            .authority(Some(&self.listing.to_account_info()))
            .new_owner(&self.maker.to_account_info())
            .system_program(Some(&self.system_program.to_account_info()))
            .invoke_signed(signer_seeds)?;

        Ok(())
    }
}
