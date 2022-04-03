import * as spl_token from '@solana/spl-token';
import { Connection, LAMPORTS_PER_SOL, PublicKey, Signer } from '@solana/web3.js';
import { getKeypair, getTokenBalance, writePublicKey } from './utils';

const createMint = (connection: Connection, payer: Signer) => {
    return spl_token.createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        0,
        undefined,
        undefined,
        spl_token.TOKEN_PROGRAM_ID
    );
}

const setupMint = async (name: string, connection: Connection, client: Signer, alice: Signer, bob: Signer):
Promise<[PublicKey, PublicKey, PublicKey]> => {
    console.log(`Creating mint ${name}...`);
    const mintPubkey = await createMint(connection, client);
    writePublicKey(`mint_${name.toLowerCase()}`, mintPubkey);

    console.log(`Creating Alice token account for ${name}...`);
    const aliceTokenAccPubkey = await spl_token.createAssociatedTokenAccount(connection, alice, mintPubkey, alice.publicKey);
    writePublicKey(`alice_${name.toLowerCase()}`, aliceTokenAccPubkey);

    console.log(`Creating Bob token account for ${name}...`);
    const bobTokenAccPubkey = await spl_token.createAssociatedTokenAccount(connection, bob, mintPubkey, bob.publicKey);
    writePublicKey(`bob_${name.toLowerCase()}`, bobTokenAccPubkey);

    return [mintPubkey, aliceTokenAccPubkey, bobTokenAccPubkey];
}

const setup = async () => {
    const connection = new Connection('http://localhost:8899', 'confirmed');
    const client = getKeypair('id');
    const alice = getKeypair('alice');
    const bob = getKeypair('bob');
    
    console.log('Requesting SOL for Client...');
    await connection.requestAirdrop(client.publicKey, LAMPORTS_PER_SOL * 10);

    console.log('Requesting SOL for Alice...');
    await connection.requestAirdrop(alice.publicKey, LAMPORTS_PER_SOL * 10);

    console.log('Requesting SOL for Bob...');
    await connection.requestAirdrop(bob.publicKey, LAMPORTS_PER_SOL * 10);

    const [mintPubkeyAvo, aliceTokenAccPubkeyAvo, bobTokenAccPubkeyAvo] = await setupMint('AVO', connection, client, alice, bob);
    console.log('Sending 50 AVO to Alice AVO token account...');
    await spl_token.mintTo(connection, client, mintPubkeyAvo, aliceTokenAccPubkeyAvo, client, 50);

    const [mintPubkeyBun, aliceTokenAccPubkeyBun, bobTokenAccPubkeyBun] = await setupMint('BUN', connection, client, alice, bob);
    console.log('Sending 50 BUN to Bob BUN token account...');
    await spl_token.mintTo(connection, client, mintPubkeyBun, bobTokenAccPubkeyBun, client, 50);

    console.table([{
        'Alice AVO Token Account': await getTokenBalance(connection, aliceTokenAccPubkeyAvo),
        'Alice BUN Token Account': await getTokenBalance(connection, aliceTokenAccPubkeyBun),
        'Bob AVO Token Account': await getTokenBalance(connection, bobTokenAccPubkeyAvo),
        'Bob BUN Token Account': await getTokenBalance(connection, bobTokenAccPubkeyBun)
    }]);
}

setup();