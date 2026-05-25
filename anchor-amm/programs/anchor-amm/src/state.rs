use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub seed: u64,       // seed to create different pools / config
    pub mint_x: Pubkey,  // token x
    pub mint_y: Pubkey,  // token y
    pub fee: u16,        // swap fee in basis points
    pub locked: bool,    // if the pool is locked
    pub activated: bool, // true once first swap has executed
    pub config_bump: u8, // bump seed for the config account
    pub lp_bump: u8,     // bump seed for the lp token
}

#[account]
#[derive(InitSpace)]
pub struct Analytics {
    pub admin: Pubkey,       // global admin, can lock/unlock any pool
    pub tvl_wsol: u64,       // sum of WSOL-side reserves across pools (lamports)
    pub volume_wsol: u64,    // all-time WSOL-leg swap volume (lamports)
    pub swaps: u64,          // total swaps executed
    pub pairs_created: u64,  // total pools ever initialized
    pub active_pairs: u64,   // currently unlocked pools
    pub created_at: i64,     // unix timestamp at analytics init
    pub bump: u8,
}
