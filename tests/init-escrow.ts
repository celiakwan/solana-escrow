import * as spl_token from '@solana/spl-token';
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Transaction,
    TransactionInstruction
} from '@solana/web3.js';
import BN = require('bn.js');
import {
    ESCROW_ACCOUNT_DATA_LAYOUT,
    ESCROW_LAYOUT,
    getKeypair,
    getProgramId,
    getPublicKey,
    getTokenBalance,
    writePublicKey
} from './utils';

const initEscrow = async () => {
    const connection = new Connection('http://localhost:8899', 'confirmed');
    const alice = getKeypair('alice');
    const aliceTokenAccPubkeyAvo = getPublicKey('alice_avo');
    const aliceTokenAccPubkeyBun = getPublicKey('alice_bun');
    const bobTokenAccPubkeyAvo = getPublicKey('bob_avo');
    const bobTokenAccPubkeyBun = getPublicKey('bob_bun');
    const mintPubkeyAvo = getPublicKey('mint_avo');
    const tempTokenAccAvo = new Keypair();
    const escrow = new Keypair();
    const escrowProgramId = getProgramId();
    const aliceExpectedAmount = 10;
    const bobExpectedAmount = 5;
    
    const createTempTokenAccIx = SystemProgram.createAccount({
        fromPubkey: alice.publicKey,
        newAccountPubkey: tempTokenAccAvo.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(spl_token.AccountLayout.span),
        space: spl_token.AccountLayout.span,
        programId: spl_token.TOKEN_PROGRAM_ID
    });

    const initTempAccIx = spl_token.createInitializeAccountInstruction(
        tempTokenAccAvo.publicKey,
        mintPubkeyAvo,
        alice.publicKey,
        spl_token.TOKEN_PROGRAM_ID
    );

    const transferAvoToTempAccIx = spl_token.createTransferInstruction(
        aliceTokenAccPubkeyAvo,
        tempTokenAccAvo.publicKey,
        alice.publicKey,
        bobExpectedAmount,
        [],
        spl_token.TOKEN_PROGRAM_ID
    );

    const createEscrowAccIx = SystemProgram.createAccount({
        fromPubkey: alice.publicKey,
        newAccountPubkey: escrow.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(ESCROW_ACCOUNT_DATA_LAYOUT.span),
        space: ESCROW_ACCOUNT_DATA_LAYOUT.span,
        programId: escrowProgramId
    });

    const initEscrowIx = new TransactionInstruction({
        keys: [
            { pubkey: alice.publicKey, isSigner: true, isWritable: false },
            { pubkey: aliceTokenAccPubkeyBun, isSigner: false, isWritable: false },
            { pubkey: tempTokenAccAvo.publicKey, isSigner: false, isWritable: true },
            { pubkey: escrow.publicKey, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: spl_token.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
        ],
        programId: escrowProgramId,
        data: Buffer.from(Uint8Array.of(0, ...new BN(aliceExpectedAmount).toArray('le', 8)))
    });

    const tx = new Transaction().add(
        createTempTokenAccIx,
        initTempAccIx,
        transferAvoToTempAccIx,
        createEscrowAccIx,
        initEscrowIx
    );
    console.log('Sending Alice transactions...');
    await connection.sendTransaction(
        tx,
        [alice, tempTokenAccAvo, escrow],
        { skipPreflight: false, preflightCommitment: 'confirmed' }
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const escrowAcc = await connection.getAccountInfo(escrow.publicKey);
    if (escrowAcc === null || escrowAcc.data.length === 0) {
        console.log('Escrow account has not been initialized properly');
        process.exit(1);
    }

    const decodedEscrowState = ESCROW_ACCOUNT_DATA_LAYOUT.decode(escrowAcc.data) as ESCROW_LAYOUT;
    if (!decodedEscrowState.isInitialized) {
        console.log('isInitialized has not been set');
        process.exit(1);
    }
    if (!new PublicKey(decodedEscrowState.initializer).equals(alice.publicKey)) {
        console.log('initializer has not been set correctly');
        process.exit(1);
    }
    if (!new PublicKey(decodedEscrowState.tempTokenAccount).equals(tempTokenAccAvo.publicKey)) {
        console.log('tempTokenAccount has not been set correctly');
        process.exit(1);
    }
    if (!new PublicKey(decodedEscrowState.initializerWantedTokenAccount).equals(aliceTokenAccPubkeyBun)) {
        console.log('initializerWantedTokenAccount has not been set correctly');
        process.exit(1);
    }

    console.log('Escrow is successfully initialized');

    writePublicKey('escrow', escrow.publicKey);

    console.table([{
        'Alice AVO Token Account': await getTokenBalance(connection, aliceTokenAccPubkeyAvo),
        'Alice BUN Token Account': await getTokenBalance(connection, aliceTokenAccPubkeyBun),
        'Bob AVO Token Account': await getTokenBalance(connection, bobTokenAccPubkeyAvo),
        'Bob BUN Token Account': await getTokenBalance(connection, bobTokenAccPubkeyBun),
        'Temp AVO Token Account': await getTokenBalance(connection, tempTokenAccAvo.publicKey)
    }]);
}

initEscrow();