use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Marketplace {
    pub admin: Pubkey,    // + 32
    pub fee: u16,         // + 2
    pub bump: u8,         // + 1
    pub rewards_bump: u8, // + 1
    #[max_len(32)]
    pub name: String, // + 4 + 32 * 4
}

#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub maker: Pubkey, // + 32
    pub asset: Pubkey, // + 32
    pub mint: Pubkey,  // + 32
    pub decimals: u8,  //  + 1
    pub price: u64,    // + 8
    pub bump: u8,      // + 1
}
