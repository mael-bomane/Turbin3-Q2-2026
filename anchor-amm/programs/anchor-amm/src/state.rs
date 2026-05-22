use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub seed: u64,                 // seed to create different pools / config
    pub authority: Option<Pubkey>, // if we want an authority to lock the config account
    pub mint_x: Pubkey,            // token x
    pub mint_y: Pubkey,            // token y
    pub fee: u16,                  // swap fee in basis points
    pub locked: bool,              // if the pool is locked
    pub config_bump: u8,           // bump seed for the config account
    pub lp_bump: u8,               // bump seed for the lp token
}
