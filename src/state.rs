use arrayref::{array_mut_ref, array_ref, array_refs, mut_array_refs};
use solana_program::{
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack, Sealed},
    pubkey::Pubkey,
};

pub struct Escrow {
    pub is_initialized: bool,
    pub initializer: Pubkey,
    pub temp_token_account: Pubkey,
    pub initializer_wanted_token_account: Pubkey,
    pub amount: u64,
}

impl Sealed for Escrow {}

impl IsInitialized for Escrow {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl Pack for Escrow {
    const LEN: usize = 105;

    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let data = array_ref![src, 0, Escrow::LEN];
        let (
            is_initialized,
            initializer,
            temp_token_account,
            initializer_wanted_token_account,
            amount,
        ) = array_refs![data, 1, 32, 32, 32, 8];

        Ok(Escrow {
            is_initialized: match is_initialized {
                [0] => false,
                [1] => true,
                _ => return Err(ProgramError::InvalidAccountData),
            },
            initializer: Pubkey::new_from_array(*initializer),
            temp_token_account: Pubkey::new_from_array(*temp_token_account),
            initializer_wanted_token_account: Pubkey::new_from_array(
                *initializer_wanted_token_account,
            ),
            amount: u64::from_le_bytes(*amount),
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let data = array_mut_ref![dst, 0, Escrow::LEN];
        let (
            is_initialized,
            initializer,
            temp_token_account,
            initializer_wanted_token_account,
            amount,
        ) = mut_array_refs![data, 1, 32, 32, 32, 8];

        *is_initialized = [*&self.is_initialized as u8];
        initializer.copy_from_slice(&self.initializer.as_ref());
        temp_token_account.copy_from_slice(&self.temp_token_account.as_ref());
        initializer_wanted_token_account
            .copy_from_slice(&self.initializer_wanted_token_account.as_ref());
        *amount = *&self.amount.to_le_bytes();
    }
}
