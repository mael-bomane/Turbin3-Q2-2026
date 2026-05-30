use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid asset owner")]
    InvalidOwner,
    #[msg("Invalid ipdate authority")]
    InvalidAuthority,
    #[msg("Already staked")]
    AlreadyStaked,
    #[msg("Not staked")]
    NotStaked,
    #[msg("Invalid Timestamp")]
    InvalidTimestamp,
    #[msg("Freeze period not elapsed")]
    FreezePeriodNotElapsed,
    #[msg("Invalid rewards bps")]
    InvalidRewardsBps,
}
