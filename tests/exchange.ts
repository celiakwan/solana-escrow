import * as spl_token from '@solana/spl-token';
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import BN = require('bn.js');
import {
    ESCROW_ACCOUNT_DATA_LAYOUT,
    ESCROW_LAYOUT,
    getKeypair,
    getProgramId,
    getPublicKey,
    getTokenBalance
} from './utils';

const exchange = async () => {
    const connection = new Connection('http://localhost:8899', 'confirmed');
    const aliceTokenAccPubkeyAvo = getPublicKey('alice_avo');
    const aliceTokenAccPubkeyBun = getPublicKey('alice_bun');
    const bob = getKeypair('bob');
    const bobTokenAccPubkeyAvo = getPublicKey('bob_avo');
    const bobTokenAccPubkeyBun = getPublicKey('bob_bun');
    const escrowAccPubkey = getPublicKey('escrow');
    const escrowProgramId = getProgramId();
    const aliceExpectedAmount = 10;
    const bobExpectedAmount = 5;

    const escrowAcc = await connection.getAccountInfo(escrowAccPubkey);
    if (escrowAcc === null) {
        console.log('Could not find escrow account');
        process.exit(1);
    }

    const decodedEscrowState = ESCROW_ACCOUNT_DATA_LAYOUT.decode(escrowAcc.data) as ESCROW_LAYOUT;
    const tempTokenAccount = new PublicKey(decodedEscrowState.tempTokenAccount);
    const pda = await PublicKey.findProgramAddress([Buffer.from('escrow')], escrowProgramId);
    const exchangeIx = new TransactionInstruction({
        keys: [
            { pubkey: bob.publicKey, isSigner: true, isWritable: false },
            { pubkey: bobTokenAccPubkeyBun, isSigner: false, isWritable: true },
            { pubkey: bobTokenAccPubkeyAvo, isSigner: false, isWritable: true },
            { pubkey: tempTokenAccount, isSigner: false, isWritable: true },
            { pubkey: new PublicKey(decodedEscrowState.initializer), isSigner: false, isWritable: true },
            { pubkey: new PublicKey(decodedEscrowState.initializerWantedTokenAccount), isSigner: false, isWritable: true },
            { pubkey: escrowAccPubkey, isSigner: false, isWritable: true },
            { pubkey: spl_token.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: pda[0], isSigner: false, isWritable: false }
        ],
        programId: escrowProgramId,
        data: Buffer.from(Uint8Array.of(1, ...new BN(bobExpectedAmount).toArray('le', 8)))
    });

    const [aliceBalanceBun, bobBalanceAvo] = await Promise.all([
        getTokenBalance(connection, aliceTokenAccPubkeyBun),
        getTokenBalance(connection, bobTokenAccPubkeyAvo),
    ]);

    console.log('Sending Bob transaction...');
    await connection.sendTransaction(
        new Transaction().add(exchangeIx),
        [bob],
        { skipPreflight: false, preflightCommitment: 'confirmed' }
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    if ((await connection.getAccountInfo(escrowAccPubkey)) !== null) {
        console.log('Escrow account has not been closed');
        process.exit(1);
    }
    if ((await connection.getAccountInfo(tempTokenAccount)) !== null) {
        console.log('Temp AVO token account has not been closed');
        process.exit(1);
    }

    const [newAliceBalanceBun, newBobBalanceAvo] = await Promise.all([
        getTokenBalance(connection, aliceTokenAccPubkeyBun),
        getTokenBalance(connection, bobTokenAccPubkeyAvo),
    ]);

    if (newAliceBalanceBun !== aliceBalanceBun + aliceExpectedAmount) {
        console.log('Alice BUN balance is not correct');
        process.exit(1);
    }
    if (newBobBalanceAvo !== bobBalanceAvo + bobExpectedAmount) {
        console.log('Bob AVO balance is not correct');
        process.exit(1);
    }

    console.log('Exchanged successfully');

    console.table([{
        'Alice AVO Token Account': await getTokenBalance(connection, aliceTokenAccPubkeyAvo),
        'Alice BUN Token Account': newAliceBalanceBun,
        'Bob AVO Token Account': newBobBalanceAvo,
        'Bob BUN Token Account': await getTokenBalance(connection, bobTokenAccPubkeyBun)
    }]);
}

exchange();