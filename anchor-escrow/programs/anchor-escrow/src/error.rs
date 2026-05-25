use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Requested amount must be greater than zero")]
    ZeroAmount,
    #[msg("Requested amount exceeds remaining escrow balance")]
    InsufficientRemaining,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
