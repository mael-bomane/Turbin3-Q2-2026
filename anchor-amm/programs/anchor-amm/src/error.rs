use anchor_lang::prelude::*;
use constant_product_curve::CurveError;

#[error_code]
pub enum AmmError {
    #[msg("fee percentage can only be between 0 to 100 (10,000 basis points)")]
    FeePercentErr,
    #[msg("Default error")]
    DefaultError,
    #[msg("Offer expired")]
    OfferExpired,
    #[msg("Pool locked")]
    PoolLocked,
    #[msg("Pool already unlocked")]
    PoolUnlocked,
    #[msg("Slippage Exceeded")]
    SlippageExceeded,
    #[msg("Overflow detected")]
    Overflow,
    #[msg("Underflow detected")]
    Underflow,
    #[msg("Invalid token")]
    InvalidToken,
    #[msg("Actual liquidity is less than minimum")]
    LiquidityLessThanMinimum,
    #[msg("No liquidity in pool")]
    NoLiquidityInPool,
    #[msg("Bump error")]
    BumpError,
    #[msg("Curve error")]
    CurveError,
    #[msg("Fee is greater than 100%. This is not a very good deal")]
    InvalidFee,
    #[msg("Invalid update authority")]
    InvalidAuthority,
    #[msg("No update authority set")]
    NoAuthoritySet,
    #[msg("Invalid Amount")]
    InvalidAmount,
    #[msg("Invalid Precision")]
    InvalidPrecision,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Zero balance")]
    ZeroBalance,
}

impl From<CurveError> for AmmError {
    fn from(error: CurveError) -> AmmError {
        match error {
            CurveError::InvalidPrecision => AmmError::InvalidPrecision,
            CurveError::Overflow => AmmError::Overflow,
            CurveError::Underflow => AmmError::Underflow,
            CurveError::InvalidFeeAmount => AmmError::InvalidFee,
            CurveError::InsufficientBalance => AmmError::InsufficientBalance,
            CurveError::ZeroBalance => AmmError::ZeroBalance,
            CurveError::SlippageLimitExceeded => AmmError::SlippageExceeded,
        }
    }
}
