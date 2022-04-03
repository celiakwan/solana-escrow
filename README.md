# solana-escrow
An escrow program written in Rust for asset exchange between two parties on Solana.

### Flows
Assume there is a scenario that Alice wants to exchange 5 token A to 10 token B with Bob.
1. Alice starts the trade by creating a temp token account and fund it with 5 token A.
2. Alice initializes an escrow account and transfers the ownership of the temp token account to the escrow program.
3. Bob confirms the trade.
4. 10 token B is transferred from Bob's token account to Alice's token account, and 5 token A is transferred from the temp token account to Bob's token account.

### Version
- [Solana Tool Suite](https://solana.com/): 1.8.12
- [Rust](https://www.rust-lang.org/): 1.58.0
- [TypeScript](https://www.typescriptlang.org/): 4.3.5
- [Solana Program Library](https://spl.solana.com/): 0.2.0

### Installation
Install Solana Tool Suite.
```
sh -c "$(curl -sSfL https://release.solana.com/v1.8.12/install)"
```

Update the `PATH` environment variable to include Solana programs by adding the following command to `.profile` and `.zshrc` in your home directory.
```
export PATH="/Users/celiakwan/.local/share/solana/install/active_release/bin:$PATH"
```
Then run this to make the changes applicable in the shell.
```
source ~/.zshrc
```

Install Rust.
```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Install `ts-node` globally.
```
npm install ts-node -g
```

Install the required Node.js packages in this project including `@solana/spl-token`.
```
npm install
```

### Configuration
1. Generate a default key pair. This key pair will automatically start with 500,000,000 SOL.
```
solana-keygen new
```

2. Generate key pairs for Alice, Bob and the transaction payer.
```
solana-keygen new -o keys/alice.json
solana-keygen new -o keys/bob.json
solana-keygen new -o keys/id.json
```

3. Retrieve the public keys of them.
```
echo "\"$(solana address -k keys/alice.json)\"" > keys/alice_pub.json
echo "\"$(solana address -k keys/bob.json)\"" > keys/bob_pub.json
echo "\"$(solana address -k keys/id.json)\"" > keys/id_pub.json
```

4. Set the network to localhost.
```
solana config set --url localhost
```

5. Transfer some SOL from the default key pair to the transaction payer.
```
solana transfer 2ZSiB5dtw9xx1ki3tFPPkcGnNXrESX8TjjwHL2mqGMiN 100 --allow-unfunded-recipient
```

### Build
```
cargo build-bpf
```

### Deployment
1. Run a local validator.
```
solana-test-validator
```

2. Deploy the program.
```
solana program deploy target/deploy/solana_escrow.so
```

3. Create a JSON file to store the program ID shown after deploying the program. For example:
```
echo "\"5rtXETUeiqAqezmNCWMKEPWz7YNng7TTWBviEnUsb65Q\"" > keys/program_pub.json
```

### Testing
1. Mint tokens and create token accounts.
```
ts-node tests/setup.ts
```

2. Initialize the escrow.
```
ts-node tests/init-escrow.ts
```

3. Exchange tokens.
```
ts-node tests/exchange.ts
```

### Reference
- https://hackmd.io/@ironaddicteddog/solana-starter-kit