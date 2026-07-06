# Wallet Setup

TrustRail needs a wallet for CROO Agent Store listing, CAP settlement, and USDC payments.

## Recommended Hackathon Flow

1. Create a fresh browser wallet, preferably MetaMask or Rabby.
2. Name it `TrustRail Agent Wallet`.
3. Back up the seed phrase offline.
4. Do not reuse your main personal wallet.
5. Add the network required by the CROO docs or Agent Store onboarding flow.
6. Fund it only with the testnet/native token amount needed for listing and testing.
7. Add the public address to `.env`:

```text
CROO_WALLET_ADDRESS=0x...
```

8. Only add `CROO_PRIVATE_KEY` for local testing if CROO's SDK requires server-side signing. Never commit `.env`.

## Getting The Private Key

In MetaMask:

1. Open the account menu.
2. Select the TrustRail account.
3. Choose account details.
4. Export private key.
5. Paste it into `.env` only on your local machine.

In Rabby:

1. Select the TrustRail account.
2. Open account details.
3. Export private key.
4. Paste it into `.env` only on your local machine.

## Production Note

For a real deployment, use a managed signer, vault, or server wallet with limited funds. The hackathon demo can use a fresh low-balance wallet so the risk stays contained.
