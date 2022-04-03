use solana_program::{
    account_info::{ AccountInfo, next_account_info },
    entrypoint::ProgramResult,
    msg,
    program::{ invoke, invoke_signed },
    program_error::ProgramError,
    program_pack::{ IsInitialized, Pack },
    pubkey::Pubkey,
    sysvar::{ rent::Rent, Sysvar }
};
use spl_token::state::Account as TokenAccount;
use crate::{ error::EscrowError, instruction::EscrowInstruction, state::Escrow };

pub struct Processor;

impl Processor {
    pub fn process(program_id: &Pubkey, accounts: &[AccountInfo], instruction_data: &[u8]) -> ProgramResult {
        let instruction = EscrowInstruction::unpack(instruction_data)?;
        match instruction {
            EscrowInstruction::InitEscrow { amount } => {
                msg!("Instruction: InitEscrow");
                Self::process_init_escrow(program_id, accounts, amount)
            },
            EscrowInstruction::Exchange { amount } => {
                msg!("Instruction: Exchange");
                Self::process_exchange(program_id, accounts, amount)
            }
        }
    }

    fn process_init_escrow(program_id: &Pubkey, accounts: &[AccountInfo], initializer_expected_amount: u64) -> ProgramResult {
        let accounts_iter = &mut accounts.iter();

        let initializer = next_account_info(accounts_iter)?;
        if !initializer.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let initializer_wanted_token_account = next_account_info(accounts_iter)?;
        if *initializer_wanted_token_account.owner != spl_token::id() {
            return Err(ProgramError::IncorrectProgramId);
        }

        let temp_token_account = next_account_info(accounts_iter)?;

        let escrow_account = next_account_info(accounts_iter)?;

        let rent_account = next_account_info(accounts_iter)?;
        let rent = &Rent::from_account_info(rent_account)?;
        if !rent.is_exempt(escrow_account.lamports(), escrow_account.data_len()) {
            return Err(EscrowError::NotRentExempt.into());
        }

        let mut escrow_info = Escrow::unpack_unchecked(&escrow_account.data.borrow())?;
        if escrow_info.is_initialized() {
            return Err(ProgramError::AccountAlreadyInitialized);
        }
        escrow_info.is_initialized = true;
        escrow_info.initializer = *initializer.key;
        escrow_info.temp_token_account = *temp_token_account.key;
        escrow_info.initializer_wanted_token_account = *initializer_wanted_token_account.key;
        escrow_info.amount = initializer_expected_amount;
        Escrow::pack(escrow_info, &mut escrow_account.data.borrow_mut())?;

        let token_program = next_account_info(accounts_iter)?;

        let (pda, _) = Pubkey::find_program_address(&[b"escrow"], program_id);

        let owner_change_ix = spl_token::instruction::set_authority(
            token_program.key,
            temp_token_account.key,
            Some(&pda),
            spl_token::instruction::AuthorityType::AccountOwner,
            initializer.key,
            &[initializer.key]
        )?;
        msg!("Calling the token program to transfer token account ownership...");
        invoke(&owner_change_ix, &[token_program.clone(), temp_token_account.clone(), initializer.clone()])?;

        Ok(())
    }

    fn process_exchange(program_id: &Pubkey, accounts: &[AccountInfo], receiver_expected_amount: u64) -> ProgramResult {
        let accounts_iter = &mut accounts.iter();

        let receiver = next_account_info(accounts_iter)?;
        if !receiver.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let receiver_sending_token_account = next_account_info(accounts_iter)?;

        let receiver_wanted_token_account = next_account_info(accounts_iter)?;

        let pda_temp_token_account = next_account_info(accounts_iter)?;
        let pda_temp_token_account_info = TokenAccount::unpack(&pda_temp_token_account.data.borrow())?;
        if receiver_expected_amount != pda_temp_token_account_info.amount {
            return Err(EscrowError::ExpectedAmountMismatch.into());
        }

        let initializer = next_account_info(accounts_iter)?;

        let initializer_wanted_token_account = next_account_info(accounts_iter)?;

        let escrow_account = next_account_info(accounts_iter)?;
        let escrow_info = Escrow::unpack(&escrow_account.data.borrow())?;
        if escrow_info.temp_token_account != *pda_temp_token_account.key {
            return Err(ProgramError::InvalidAccountData);
        }
        if escrow_info.initializer != *initializer.key {
            return Err(ProgramError::InvalidAccountData);
        }
        if escrow_info.initializer_wanted_token_account != *initializer_wanted_token_account.key {
            return Err(ProgramError::InvalidAccountData);
        }

        let token_program = next_account_info(accounts_iter)?;

        let transfer_to_initializer_ix = spl_token::instruction::transfer(
            token_program.key,
            receiver_sending_token_account.key,
            initializer_wanted_token_account.key,
            receiver.key,
            &[receiver.key],
            escrow_info.amount
        )?;
        msg!("Calling the token program to transfer tokens to the escrow's initializer...");
        invoke(&transfer_to_initializer_ix, &[
            token_program.clone(),
            receiver_sending_token_account.clone(),
            initializer_wanted_token_account.clone(),
            receiver.clone()
        ])?;

        let (pda, bump) = Pubkey::find_program_address(&[b"escrow"], program_id);

        let pda_account = next_account_info(accounts_iter)?;

        let transfer_to_receiver_ix = spl_token::instruction::transfer(
            token_program.key,
            pda_temp_token_account.key,
            receiver_wanted_token_account.key,
            &pda,
            &[&pda],
            pda_temp_token_account_info.amount
        )?;
        msg!("Calling the token program to transfer tokens to the receiver...");
        invoke_signed(
            &transfer_to_receiver_ix,
            &[
                token_program.clone(),
                pda_temp_token_account.clone(),
                receiver_wanted_token_account.clone(),
                pda_account.clone()
            ],
            &[&[b"escrow", &[bump]]]
        )?;

        let close_pda_temp_token_account_ix = spl_token::instruction::close_account(
            token_program.key,
            pda_temp_token_account.key,
            initializer.key,
            &pda,
            &[&pda]
        )?;
        msg!("Calling the token program to close pda's temp account...");
        invoke_signed(
            &close_pda_temp_token_account_ix,
            &[
                token_program.clone(),
                pda_temp_token_account.clone(),
                initializer.clone(),
                pda_account.clone()
            ],
            &[&[b"escrow", &[bump]]]
        )?;

        msg!("Closing the escrow account...");
        **initializer.lamports.borrow_mut() = initializer.lamports().checked_add(escrow_account.lamports())
        .ok_or(EscrowError::AmountOverflow)?;
        **escrow_account.lamports.borrow_mut() = 0;
        *escrow_account.data.borrow_mut() = &mut [];

        Ok(())
    }
}