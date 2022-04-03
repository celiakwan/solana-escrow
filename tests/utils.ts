import * as BufferLayout from '@solana/buffer-layout';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';

export const getPublicKey = (name: string) => {
  return new PublicKey(JSON.parse(fs.readFileSync(`keys/${name}_pub.json`) as unknown as string));
}

export const getKeypair = (name: string) => {
  return new Keypair({ publicKey: getPublicKey(name).toBytes(), secretKey: getPrivateKey(name) });
}

export const getTokenBalance = async (connection: Connection, pubkey: PublicKey) => {
  return parseInt((await connection.getTokenAccountBalance(pubkey)).value.amount);
}

export const getProgramId = () => {
  try {
    return getPublicKey('program');
  } catch (e) {
    console.log('Incorrect programId');
    process.exit(1);
  }
}

export const writePublicKey = (name: string, pubkey: PublicKey) => {
  fs.writeFileSync(`keys/${name}_pub.json`, JSON.stringify(pubkey.toString()));
}

const getPrivateKey = (name: string) => {
  return Uint8Array.from(JSON.parse(fs.readFileSync(`keys/${name}.json`) as unknown as string));
}

const publicKey = (property = 'publicKey') => {
  return BufferLayout.blob(32, property);
}

const uint64 = (property = 'uint64') => {
  return BufferLayout.blob(8, property);
}

export const ESCROW_ACCOUNT_DATA_LAYOUT = BufferLayout.struct([
  BufferLayout.u8('isInitialized'),
  publicKey('initializer'),
  publicKey('tempTokenAccount'),
  publicKey('initializerWantedTokenAccount'),
  uint64('amount'),
] as any[]);

export interface ESCROW_LAYOUT {
  isInitialized: number;
  initializer: Uint8Array;
  tempTokenAccount: Uint8Array;
  initializerWantedTokenAccount: Uint8Array;
  amount: Uint8Array;
}