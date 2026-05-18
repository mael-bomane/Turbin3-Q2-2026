use anchor_lang::prelude::*;

#[derive(InitSpace)]
#[account(discriminator = 1)]
pub struct Escrow {
    pub seed: u64,
    pub maker: Pubkey,
    pub mint_a: Pubkey,
    pub amount_a: u64,
    pub mint_b: Pubkey,
    pub amount_b: u64,
    pub created_at: i64,
    pub bump: u8,
}
