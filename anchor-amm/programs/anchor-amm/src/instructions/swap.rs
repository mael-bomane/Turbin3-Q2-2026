use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};
use constant_product_curve::{ConstantProduct, LiquidityPair};

use crate::{
    constants::{ANALYTICS_SEED, WSOL_MINT},
    error::AmmError,
    state::{Analytics, Config},
};

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub mint_x: Box<Account<'info, Mint>>,
    pub mint_y: Box<Account<'info, Mint>>,
    #[account(
        mut,
        has_one = mint_x,
        has_one = mint_y,
        seeds = [b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump,
    )]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut,
        seeds = [ANALYTICS_SEED],
        bump = analytics.bump,
    )]
    pub analytics: Box<Account<'info, Analytics>>,
    #[account(
        seeds = [b"lp", config.key().as_ref()],
        bump = config.lp_bump,
    )]
    pub mint_lp: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = mint_x,
        associated_token::authority = config,
    )]
    pub vault_x: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint_y,
        associated_token::authority = config,
    )]
    pub vault_y: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint_x,
        associated_token::authority = user,
    )]
    pub user_x: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint_y,
        associated_token::authority = user,
    )]
    pub user_y: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Swap<'info> {
    pub fn swap(&mut self, is_x: bool, amount: u64, min: u64) -> Result<()> {
        require!(!self.config.locked, AmmError::PoolLocked);
        require!(amount > 0, AmmError::InvalidAmount);
        let mut curve: ConstantProduct = ConstantProduct::init(
            self.vault_x.amount,
            self.vault_y.amount,
            self.mint_lp.supply,
            self.config.fee,
            Some(6),
        )
        .unwrap();

        let p: LiquidityPair = match is_x {
            true => LiquidityPair::X,
            false => LiquidityPair::Y,
        };

        let swap_result: constant_product_curve::SwapResult = curve
            .swap(p, amount, min)
            .map_err(|_| AmmError::SlippageExceeded)?;

        self.deposit_tokens(is_x, swap_result.deposit)?;
        self.withdraw_tokens(!is_x, swap_result.withdraw)?;

        self.update_analytics(is_x, swap_result.deposit, swap_result.withdraw)
    }

    fn update_analytics(&mut self, is_x: bool, deposit: u64, withdraw: u64) -> Result<()> {
        let wsol_is_x = self.mint_x.key() == WSOL_MINT;
        let wsol_is_y = self.mint_y.key() == WSOL_MINT;

        if wsol_is_x || wsol_is_y {
            // WSOL leg flow: amount on the WSOL side, regardless of direction.
            let (wsol_flow, tvl_add, tvl_sub) = match (wsol_is_x, is_x) {
                (true, true) => (deposit, deposit, 0u64),    // user deposits WSOL (=X)
                (true, false) => (withdraw, 0u64, withdraw), // user withdraws WSOL (=X)
                (false, true) => (withdraw, 0u64, withdraw), // user withdraws WSOL (=Y)
                (false, false) => (deposit, deposit, 0u64),  // user deposits WSOL (=Y)
            };

            self.analytics.volume_wsol = self
                .analytics
                .volume_wsol
                .checked_add(wsol_flow)
                .ok_or(AmmError::Overflow)?;
            self.analytics.tvl_wsol = self
                .analytics
                .tvl_wsol
                .checked_add(tvl_add)
                .ok_or(AmmError::Overflow)?
                .checked_sub(tvl_sub)
                .ok_or(AmmError::Underflow)?;
        }

        self.analytics.swaps = self
            .analytics
            .swaps
            .checked_add(1)
            .ok_or(AmmError::Overflow)?;

        if !self.config.activated {
            self.config.activated = true;
            self.analytics.active_pairs = self
                .analytics
                .active_pairs
                .checked_add(1)
                .ok_or(AmmError::Overflow)?;
        }

        Ok(())
    }

    pub fn deposit_tokens(&mut self, is_x: bool, amount: u64) -> Result<()> {
        let (from, to, mint, decimals) = match is_x {
            true => (
                self.user_x.to_account_info(),
                self.vault_x.to_account_info(),
                self.mint_x.to_account_info(),
                self.mint_x.decimals,
            ),
            false => (
                self.user_y.to_account_info(),
                self.vault_y.to_account_info(),
                self.mint_y.to_account_info(),
                self.mint_y.decimals,
            ),
        };

        transfer_checked(
            CpiContext::new(
                self.token_program.key(),
                TransferChecked {
                    from,
                    mint,
                    to,
                    authority: self.user.to_account_info(),
                },
            ),
            amount,
            decimals,
        )
    }

    pub fn withdraw_tokens(&mut self, is_x: bool, amount: u64) -> Result<()> {
        let (from, to, mint, decimals) = match is_x {
            true => (
                self.vault_x.to_account_info(),
                self.user_x.to_account_info(),
                self.mint_x.to_account_info(),
                self.mint_x.decimals,
            ),
            false => (
                self.vault_y.to_account_info(),
                self.user_y.to_account_info(),
                self.mint_y.to_account_info(),
                self.mint_y.decimals,
            ),
        };

        transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.key(),
                TransferChecked {
                    from,
                    mint,
                    to,
                    authority: self.config.to_account_info(),
                },
                &[&[
                    b"config",
                    &self.config.seed.to_le_bytes(),
                    &[self.config.config_bump],
                ]],
            ),
            amount,
            decimals,
        )
    }
}
