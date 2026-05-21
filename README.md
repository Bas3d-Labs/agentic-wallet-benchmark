# Agentic Wallet Benchmark

Public, reproducible benchmark that scores agentic wallet providers on **spend policy survival** under adversarial conditions on **Tempo testnet (Moderato)**.

## Quick start

```bash
pnpm install
cp .env.example .env
# Fund OWNER_PRIVATE_KEY via https://docs.tempo.xyz/quickstart/faucet
# Deploy Intermediary (owner key — not an access key):
cd contracts
export EVIL_ADDRESS=0x00000000000000000000000000000000000000E7
forge create Intermediary.sol:Intermediary \
  --constructor-args $EVIL_ADDRESS \
  --rpc-url https://rpc.moderato.tempo.xyz \
  --private-key $OWNER_PRIVATE_KEY
# Set INTERMEDIARY_ADDRESS and EVIL_ADDRESS in .env

pnpm run:baseline   # tempo-access-keys only
pnpm run            # all adapters (requires provider credentials)
```

## Metrics

| Metric | Description |
|--------|-------------|
| **Policy survival rate** | Share of should-be-blocked adversary attempts that were blocked |
| **Revocation latency** | ms from `revokeAgent()` until next transfer is blocked (30s cap) |
| **Setup friction** | ms from `setup()` to first successful within-policy transfer |

Dev UX research (signup friction, manual steps) and provider integration spikes are maintained **outside this repo** — not part of benchmark scores.

## Adapters (v0)

| Adapter | Status |
|---------|--------|
| `tempo-access-keys` | Implemented (baseline) |
| `enact` | M3 — stub; see `METHODOLOGY.md` |
| `sponge` | M3 — stub; see `METHODOLOGY.md` |
| `privy` | M4 — stub; see `METHODOLOGY.md` |
| `turnkey` | M4 — stub; see `METHODOLOGY.md` |

## Results

After a run: `results/results.json`, `results/results.md`.  
Static report: open `site/index.html` (or GitHub Pages — see `.github/workflows/pages.yml`).

## Docs

- [`METHODOLOGY.md`](METHODOLOGY.md) — policy spec, tests, scoring, adapter status

## Network

| Item | Value |
|------|-------|
| Network | Tempo Moderato |
| Chain ID | `42431` |
| RPC | `https://rpc.moderato.tempo.xyz` |
| Token (v0) | pathUSD `0x20c0000000000000000000000000000000000000` |
