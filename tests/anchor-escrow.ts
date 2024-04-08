import * as anchor from "@coral-xyz/anchor";
import { GamePool } from "../target/types/game_pool";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMint,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { randomBytes } from "crypto";
import { assert } from "chai";
import fs from 'fs'

describe("game-pool", () => {
  // 0. Set provider, connection and program
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const program = anchor.workspace.GamePool as anchor.Program<GamePool>;

  const deriveAuctionAccountPDA = async () => {
    const programAddress = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("game_pool_account")],
      program.programId
    );
    return programAddress;
  };

  it('initialises deposits and withdraws tokens', async () => {
    const userWallet = anchor.web3.Keypair.generate();
    const mintAuthorityWallet = anchor.web3.Keypair.generate();  
    const mintKeypair = anchor.web3.Keypair.generate();
    const [gamePoolAccountPDA, bump] = await deriveAuctionAccountPDA();
    const gamePoolAuthority = JSON.parse(fs.readFileSync('./gamePoolAuthority.json', 'utf-8'));
    const gamePoolAuthorityWallet = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(gamePoolAuthority));


    // airdrop authority wallet
    const authoritySignature = await program.provider.connection.requestAirdrop(
      mintAuthorityWallet.publicKey,
      5 * LAMPORTS_PER_SOL,
    )

    await program.provider.connection.confirmTransaction(authoritySignature)

    const mint = await createMint(
      provider.connection,
      mintAuthorityWallet,
      mintAuthorityWallet.publicKey,
      null,
      0
    );
    
    const userATA = await createAssociatedTokenAccount(
      provider.connection,
      mintAuthorityWallet,
      mint,
      userWallet.publicKey
    );

    const gamePoolATA = await createAssociatedTokenAccount(
      provider.connection,
      mintAuthorityWallet,
      mint,
      gamePoolAuthorityWallet.publicKey
    );

    const TOKEN_MINT_AMOUNT = 10000;

    console.log(userATA)
    console.log(mint)

    await mintTo(
      provider.connection,
      mintAuthorityWallet,
      mint,
      userATA,
      mintAuthorityWallet.publicKey,
      TOKEN_MINT_AMOUNT
    );

    const userTokenAccount = await provider.connection.getTokenAccountBalance(userATA);

    assert(userTokenAccount.value.uiAmount === TOKEN_MINT_AMOUNT, "token not minted correctly");


    await program.methods.initialise().accounts({
      gamePoolAccount: gamePoolAccountPDA,
      authority: gamePoolAuthorityWallet.publicKey,
    }).signers([gamePoolAuthorityWallet]).rpc();

    const transferSPLAmount = new anchor.BN(100);

    await program.methods.depositSplTokens(transferSPLAmount).accounts({
      gamePoolAta: gamePoolATA,
      userAta: userATA,
      user: userWallet.publicKey,
      gamePoolAccount: gamePoolAccountPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([
      userWallet
    ]).rpc();

    const gamePoolATABalance = await provider.connection.getTokenAccountBalance(gamePoolATA);
    const gamePoolPDAAccount = await program.account.gamePoolAccount.fetch(gamePoolAccountPDA);

    assert(gamePoolATABalance.value.uiAmount === transferSPLAmount.toNumber(), "amount not deposited correctly");
    assert(gamePoolPDAAccount.splTokenAmountDeposited.toNumber() === transferSPLAmount.toNumber(), "amount not deposited correctly");

    const withdrawAmount = new anchor.BN(50);

    const gamePoolWallet = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync('/Users/matas/.config/solana/id.json', 'utf-8'))));

    const withdrawSplTokens = await program.methods.withdrawSplTokens(withdrawAmount).accounts({
      gamePoolAta: gamePoolATA,
      userAta: userATA,
      gamePoolAccount: gamePoolAccountPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      authority: gamePoolAuthorityWallet.publicKey,
    }).signers([
      gamePoolAuthorityWallet
    ]).rpc();

    console.log(withdrawSplTokens, 'withdrawing')

    const gamePoolATABalance2 = await provider.connection.getTokenAccountBalance(gamePoolATA);
    const gamePoolPDAAccount2 = await program.account.gamePoolAccount.fetch(gamePoolAccountPDA);

    assert(gamePoolATABalance2.value.uiAmount === transferSPLAmount.sub(withdrawAmount).toNumber(), "amount not withdrawn correctly");
    assert(gamePoolPDAAccount2.splTokenAmountDeposited.toNumber() === transferSPLAmount.sub(withdrawAmount).toNumber(), "amount not withdrawn correctly");
  });

  // it('Testing', async () => {

  //   console.log(anchor.AnchorProvider.env().wallet.signTransaction)

  //   const [gamePoolAccountPDA, bump] = await deriveAuctionAccountPDA();
  //   // // get wallet from './gamePoolAuthority.json'
  //   const gamePoolAuthority = JSON.parse(fs.readFileSync('./gamePoolAuthority.json', 'utf-8'));
  //   const gamePoolAuthorityWallet = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(gamePoolAuthority));

  //   const userWallet = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync('/Users/matas/.config/solana/id.json', 'utf-8'))));

  //   // console.log(gamePoolAuthorityWallet.publicKey.toBase58());

  //   const authoritySignature = await program.provider.connection.requestAirdrop(
  //     mintAuthorityWallet.publicKey,
  //     1 * LAMPORTS_PER_SOL,
  //   )


  //   const mint = await createMint(
  //     provider.connection,
  //     userWallet,
  //     mintAuthorityWallet.publicKey,
  //     null,
  //     0
  //   );

  //   console.log(gamePoolAuthorityWallet.publicKey.toBase58());

  //   const mint = new PublicKey(
  //     "GMhjEWpr9YrhfrYuxzgBznE3gMh6QKscTaXCYM5kuNrK"
  //   );
    
  //   const userATA = await getAssociatedTokenAddressSync(
  //     mint,
  //     userWallet.publicKey
  //   );


  //   const gamePoolATA = await createAssociatedTokenAccount(
  //     provider.connection,
  //     gamePoolAuthorityWallet,
  //     mint,
  //     gamePoolAuthorityWallet.publicKey
  //   );

  //   const TOKEN_MINT_AMOUNT = 10000;

  //   console.log(userATA)
  //   console.log(mint)

  //   console.log('Mint:', mint.toBase58());
  //   console.log('User ATA:', userATA.toBase58());
  //   console.log('Game Pool ATA:', gamePoolATA.toBase58());

  //   // console.log(gamePoolATA);

  //   // console.log(keypair)

  //   await program.methods.initialise().accounts({
  //     gamePoolAccount: gamePoolAccountPDA,
  //     authority: gamePoolAuthorityWallet.publicKey,
  //   }).signers([gamePoolAuthorityWallet]).rpc();

  //   const transferSPLAmount = new anchor.BN(100);

  //   await program.methods.depositSplTokens(transferSPLAmount).accounts({
  //     gamePoolAta: gamePoolATA,
  //     userAta: userATA,
  //     user: userWallet.publicKey,
  //     gamePoolAccount: gamePoolAccountPDA,
  //     tokenProgram: TOKEN_PROGRAM_ID,
  //   }).signers([
  //     userWallet
  //   ]).rpc();

  //   const gamePoolATABalance = await provider.connection.getTokenAccountBalance(gamePoolATA);
  //   const gamePoolPDAAccount = await program.account.gamePoolAccount.fetch(gamePoolAccountPDA);

  //   assert(gamePoolATABalance.value.uiAmount === transferSPLAmount.toNumber(), "amount not deposited correctly");
  //   assert(gamePoolPDAAccount.splTokenAmountDeposited.toNumber() === transferSPLAmount.toNumber(), "amount not deposited correctly");


  //   const withdrawSPLAmount = new anchor.BN(50);

  //   const withdrawSplTokens = await program.methods.withdrawSplTokens(withdrawSPLAmount).accounts({
  //     gamePoolAta: gamePoolATA,
  //     userAta: userATA,
  //     gamePoolAccount: gamePoolAccountPDA,
  //     tokenProgram: TOKEN_PROGRAM_ID,
  //     authority: gamePoolAuthorityWallet.publicKey,
  //   }).transaction();


  //   const transaction = await provider.sendAndConfirm(withdrawSplTokens, [userWallet, gamePoolAuthorityWallet]);

  //   console.log(transaction, 'transaction withdraw')


  //   const gamePoolATABalance2 = await provider.connection.getTokenAccountBalance(gamePoolATA);
  //   const gamePoolPDAAccount2 = await program.account.gamePoolAccount.fetch(gamePoolAccountPDA);


  //   assert(gamePoolATABalance2.value.uiAmount === transferSPLAmount.sub(withdrawSPLAmount).toNumber(), "amount not withdrawn correctly");
  //   assert(gamePoolPDAAccount2.splTokenAmountDeposited.toNumber() === transferSPLAmount.sub(withdrawSPLAmount).toNumber(), "amount not withdrawn correctly");

  //   console.log('saize');
  // })
});
