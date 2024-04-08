use anchor_lang::prelude::*;
use anchor_lang::solana_program::entrypoint::ProgramResult;
use anchor_spl::token::{Token, TokenAccount};
use anchor_spl::token;

declare_id!("8FPMiYeoxFAW6VsK1tUCUik3okJJ7ig4Fyh2yghXYjVD");

#[program]
pub mod game_pool {

    use anchor_lang::{solana_program::{program::invoke, system_instruction::transfer}, system_program::Transfer};

    use super::*;

    pub fn initialise(ctx: Context<Initialise>) -> ProgramResult {
        let game_pool_account = &mut ctx.accounts.game_pool_account;

        if game_pool_account.is_initialized {
            return Err(ProgramError::AccountAlreadyInitialized);
        }
    
        game_pool_account.authority = *ctx.accounts.authority.key;
        game_pool_account.lamport_amount_deposited = 0;
        game_pool_account.spl_token_amount_deposited = 0;
        game_pool_account.is_initialized = true;

        Ok(())
    }

    pub fn deposit_lamports (ctx: Context<Deposit>, amount: u64) -> ProgramResult {
        let instruction = transfer(
            &ctx.accounts.user.key(), 
            &ctx.accounts.game_pool_account.key(), 
            amount
        );

        let _ = invoke(
            &instruction,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.game_pool_account.to_account_info()
            ]);

        ctx.accounts.game_pool_account.lamport_amount_deposited += amount;
        Ok(())
    }

    pub fn deposit_spl_tokens (ctx: Context<DepositSplTokens>, amount: u64) -> ProgramResult {
        let game_pool_ata = &ctx.accounts.game_pool_ata;
        let user_ata = &ctx.accounts.user_ata;
        let token_program = &ctx.accounts.token_program;
        let user = &ctx.accounts.user;


        let cpi_accounts = token::Transfer {
            from: user_ata.to_account_info(),
            to: game_pool_ata.to_account_info(),
            authority: user.to_account_info(),
        };
        let cpi_program = token_program.to_account_info();

        token::transfer(
            CpiContext::new(cpi_program, cpi_accounts),
            amount
        )?;

        ctx.accounts.game_pool_account.spl_token_amount_deposited += amount;

        Ok(())
    }

    pub fn withdraw_spl_tokens (ctx: Context<WithdrawSpltokens>, amount: u64) -> ProgramResult {
        let game_pool_ata = &ctx.accounts.game_pool_ata;
        let user_ata = &ctx.accounts.user_ata;
        let token_program = &ctx.accounts.token_program;
        let authority = &ctx.accounts.authority;

        if ctx.accounts.game_pool_account.authority != *authority.key {
            return err!(GamePoolError::IncorrectProgramId)?;
        }

        let cpi_accounts = token::Transfer {
            from: game_pool_ata.to_account_info(),
            to: user_ata.to_account_info(),
            authority: authority.to_account_info(),
        };
        let cpi_program = token_program.to_account_info();

        token::transfer(
            CpiContext::new(cpi_program, cpi_accounts),
            amount
        )?;

        ctx.accounts.game_pool_account.spl_token_amount_deposited -= amount;

        Ok(())
    }

    pub fn withdraw_lamports (ctx: Context<Withdraw>, amount: u64) -> ProgramResult {
        let game_pool_account = &mut ctx.accounts.game_pool_account;
        let authority = &ctx.accounts.authority;
        let user = &ctx.accounts.user;

        if game_pool_account.authority != *authority.key {
            return err!(GamePoolError::IncorrectProgramId)?;
        }

        let rent_balance = Rent::get()?.minimum_balance(game_pool_account.to_account_info().data_len());

		if **game_pool_account.to_account_info().lamports.borrow() - rent_balance < amount {
            return err!(GamePoolError::InsufficientFunds)?;
		}

        **game_pool_account.to_account_info().try_borrow_mut_lamports()? -= amount;
        **user.to_account_info().try_borrow_mut_lamports()? += amount;

        game_pool_account.lamport_amount_deposited -= amount;
    
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub game_pool_account: Account<'info, GamePoolAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub game_pool_account: Account<'info, GamePoolAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositSplTokens<'info> {
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub game_pool_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub game_pool_account: Account<'info, GamePoolAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawSpltokens<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub user_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub game_pool_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub game_pool_account: Account<'info, GamePoolAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Initialise<'info> {
    #[account(
        init,
        payer = user,
        space = 100,
        seeds = [b"game_pool_account".as_ref()],
        bump
    )]
    pub game_pool_account: Account<'info, GamePoolAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct GamePoolAccount {
    pub authority: Pubkey,
    pub lamport_amount_deposited: u64,
    pub spl_token_amount_deposited: u64,
    pub is_initialized: bool,
}

#[error_code]
pub enum GamePoolError {
    #[msg("The authority is not the owner of the account")]
    IncorrectProgramId,
    #[msg("Insufficient funds")]
    InsufficientFunds,
}