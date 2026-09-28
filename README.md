# Pact — escrow for freelance work

**Get paid for the work, not the promise.**

A client locks payment in a smart contract before the work starts. The freelancer marks the job delivered and the client releases the money. Both sides are protected:

- If the client goes quiet for **3 days** after delivery, the freelancer can claim the payment directly.
- If nothing is delivered by the **deadline**, the client can take the money back.
- The freelancer can return the funds at any time (for example, if they can't take the job).

No platform wallet, no admin key, no fee. Runs on **Base Sepolia** (testnet).

## Repository layout

```
contracts/   Solidity + Foundry: the Pact contract, tests and deploy script
app/         Next.js web app: connect a wallet, create and manage pacts
```

## The contract

`contracts/src/Pact.sol`

| Function | Who | When |
| --- | --- | --- |
| `createDeal(freelancer, deadline, title)` | client | sends the ETH to lock |
| `markDelivered(id)` | freelancer | while the deal is funded |
| `release(id)` | client | funded or delivered |
| `claim(id)` | freelancer | 3 days after delivery, if the client hasn't released |
| `refund(id)` | freelancer: any time before payout · client: after the deadline, if not delivered | |

Safety notes:
- Checks-effects-interactions: the status is final before any ETH moves, so re-entrant calls see a settled deal and revert.
- Custom errors for every failure, events for every state change.
- `dealsOf(address)` lists every deal an address is part of, so the app needs no indexer.

### Tests

21 tests, including fuzz tests (1,000 runs each), a re-entrancy attack and a recipient that rejects ETH. **100% line, statement, branch and function coverage.**

```bash
cd contracts
forge test
forge coverage --no-match-coverage "test|script"
```

## The app

Next.js 16, wagmi 3 and viem. Anyone can browse the latest pacts without a wallet; connecting a wallet shows your own pacts with the actions your role allows. Reads refresh every 12 seconds, so the other party's actions appear without a reload.

```bash
cd app
npm install
# .env.local
#   NEXT_PUBLIC_PACT_ADDRESS=0x…        deployed contract
#   NEXT_PUBLIC_PACT_CHAIN=base-sepolia  (default) or "anvil" for local development
npm run dev
```

### Local development with anvil

```bash
anvil
cd contracts && forge script script/Deploy.s.sol --rpc-url anvil --broadcast --unlocked --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
# app/.env.development.local
#   NEXT_PUBLIC_PACT_CHAIN=anvil
#   NEXT_PUBLIC_PACT_ADDRESS=<address printed above>
#   NEXT_PUBLIC_MOCK_WALLET=1            adds a test wallet backed by anvil's dev accounts
```

## Deploying to Base Sepolia

```bash
cast wallet import pact-deployer --interactive   # stores your key encrypted; never in a file
cd contracts
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --account pact-deployer
```

## Author

Designed and built by **Moch Virgiawan Caesar Ridollohi** ([mvirgiawancr on Contra](https://contra.com/moch_virgiawan_caesar_r_w19nvsk6)).
