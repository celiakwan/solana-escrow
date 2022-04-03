use solana_program::program_error::ProgramError;
use std::convert::TryInto;
use crate::error::EscrowError::InvalidInstruction;

pub enum EscrowInstruction {
    InitEscrow {
        amount: u64
    },
    Exchange {
        amount: u64
    }
}

impl EscrowInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (tag, rest) = input.split_first().ok_or(InvalidInstruction)?;
        match tag {
            0 => Ok(Self::InitEscrow {
                amount: Self::unpack_amount(rest)?
            }),
            1 => Ok(Self::Exchange {
                amount: Self::unpack_amount(rest)?
            }),
            _ => Err(InvalidInstruction.into())
        }
    }

    fn unpack_amount(input: &[u8]) -> Result<u64, ProgramError> {
        Ok(u64::from_le_bytes(input
            .get(..8)
            .and_then(|slice| slice.try_into().ok())
            .unwrap()
        ))
    }
}