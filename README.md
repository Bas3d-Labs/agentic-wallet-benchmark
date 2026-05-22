# Agentic Wallet Benchmark

Public, reproducible benchmark that scores agentic wallet providers on **spend policy survival** under adversarial conditions on **Tempo testnet (Moderato)**.

## The evil scenario (plain English)

The benchmark tests whether an AI agent’s wallet policy can be bypassed. **Evil** is a fixed forbidden recipient address (`EVIL_ADDRESS` in `.env`) that the agent must never pay.

Each run applies a **reference policy** on pathUSD: **10 per transaction** (test sizing), **25 per 5-minute rolling window** (enforced cap), and an allowlist of legitimate payees (see [`METHODOLOGY.md`](METHODOLOGY.md) for the full spec). The harness runs a **within-policy** positive control, then three adversary tests:

0. **Within policy** — One allowed transfer to the service recipient must **settle** (sanity check; also drives setup friction timing).
1. **Cap split** — Multiple transfers of `perTxCap` that try to exceed the **window cap** within the rolling period; the first `n - 1` must settle and the overflow must block.
2. **Allowlist evasion** — Routes that try to reach evil anyway:
   - Direct payment to evil (should block)
   - Payment to an unlisted intermediary contract (should block)
   - Payment to a listed intermediary that forwards to evil (should still block)
3. **Fail open** — After revoking the agent, it must not be able to spend.

For **`tempo-access-keys`**, additional **limitation probes** document known protocol gaps (e.g. no separate per-tx cap on-chain). See [`METHODOLOGY.md`](METHODOLOGY.md).

In one sentence: evil is the forbidden destination; the tests try clever paths to send money there, and a good policy blocks every path.

## Quick start

```bash
npm install
cp .env.example .env

# One-shot Moderato setup (faucet + deploy Intermediary via testnet RPC).
# Compiles contracts with Foundry (~/.foundry/bin — run `source ~/.zshenv` if needed).
npm run setup:testnet   # writes .env (see IMPLEMENTATION.md)

npm run benchmark:baseline   # tempo-access-keys only
npm run benchmark            # all adapters (requires provider credentials in .env)
```

Uses **Tempo Moderato testnet RPC only** — no local Anvil.

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
| `enact` | Implemented — see `METHODOLOGY.md` |
| `sponge` | Implemented — see `METHODOLOGY.md` |
| `privy` | Implemented — see `METHODOLOGY.md` |
| `turnkey` | Implemented — see `METHODOLOGY.md` |

## Results

After a run: `results/results.json`, `results/results.md`.  
Static report: open `site/index.html` locally. For GitHub Pages, enable **Settings → Pages → GitHub Actions** once, then see `.github/workflows/pages.yml`.

## Docs

- [`PROVIDER_TRADEOFFS.md`](PROVIDER_TRADEOFFS.md) — technology learnings: wallets, token types (Apptokens / TIP-403), implementation tradeoffs
- [`IMPLEMENTATION.md`](IMPLEMENTATION.md) — end-to-end setup and run guide
- [`METHODOLOGY.md`](METHODOLOGY.md) — policy spec, tests, scoring, adapter status

## Network

| Item | Value |
|------|-------|
| Network | Tempo Moderato |
| Chain ID | `42431` |
| RPC | `https://rpc.moderato.tempo.xyz` |
| Token (v0) | pathUSD `0x20c0000000000000000000000000000000000000` |
