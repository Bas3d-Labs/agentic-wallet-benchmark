# Methodology

**Network:** Tempo testnet (Moderato) · **Chain ID:** 42431  
Results are observed measurements on testnet — not production deployments.

## Reference policy

| Field | v0 value |
|-------|----------|
| Token | pathUSD (`0x20c0000000000000000000000000000000000000`) |
| Per-tx cap | 10 pathUSD |
| Window cap | 25 pathUSD / 24h rolling window |
| Allowlist | Service recipient `SVC` only (plus intermediary for sub-test c) |

Wallet adapters translate this `PolicySpec` into each provider's primitives. Token-level TIP-403 policies are out of scope for v0.

## Scenario addresses

- **SVC** — ephemeral allowlisted service payee (generated per run)
- **EVIL** — fixed address (`EVIL_ADDRESS` env), never allowlisted
- **Intermediary** — deployed contract; `depositAndForward` pulls from agent and forwards to `EVIL`

Deploy Intermediary with `EVIL` as constructor arg so on-chain forward target matches the harness.

## Adversary tests

### 1. Cap split

`n = floor(windowCap / perTxCap) + 1` transfers of `perTxCap` to **SVC**.  
**Pass:** at least one transfer is **blocked** (window cap enforced).  
**Fail:** all `n` settle.

### 2. Allowlist evasion

| Sub | Action | Expected |
|-----|--------|----------|
| a | Transfer to **EVIL** | blocked |
| b | Transfer to **Intermediary** (not allowlisted) | blocked |
| c | Add **Intermediary** to allowlist; transfer with `forwardTo: EVIL` | blocked if final recipient enforced; settles if only immediate `to` checked |

### 3. Fail-open

Off-chain adapters: simulate signing/policy backend outage, then attempt within-policy transfer to **SVC**.  
**Pass:** blocked or error. **Fail:** settles.

On-chain adapters (e.g. tempo-access-keys): **N/A** — favorable; policy persists without a backend.

## Scoring

### Policy survival rate (headline)

```
correctly_blocked / should_be_blocked
```

Across cap-split, allowlist sub-attempts (a,b,c), and fail-open (when applicable).  
Target reference: **100%** (see project FOUNDATION when published in knowledge-base).

### Revocation latency

Wall-clock from `revokeAgent()` return until first subsequent `attemptTransfer` returns `blocked` or `error`. Poll every 500ms; timeout 30s.

### Setup friction

Wall-clock from `setup()` start to first successful within-policy transfer, plus integration line count and manual step count (informational).

**Do not** combine metrics into a single score.

## Fairness rules

1. Identical adversary code for every adapter.
2. Fresh `setup` → `fund` → `setPolicy` before each test.
3. Fixed test order: cap-split → allowlist-evasion → fail-open.
4. Provider-specific logic stays inside adapters only.

## Caveats

- Fail-open is architectural when signing and policy share one service — document per adapter.
- Revocation semantics differ (key revoke vs policy delete vs wallet disable) — closest analogue documented per adapter.
- Enact/Sponge may require interactive signup — manual steps count toward setup friction, not benchmark scores.

## Adapter status

Condensed from internal integration research (maintained outside this repo).

### `tempo-access-keys` (baseline)

Implemented. **Enforcement:** protocol (AccountKeychain precompile). Headless: owner key + faucet only; fail-open N/A.

### `enact` (M3)

**Enforcement:** protocol (expected). **Surface:** `enact init` + JSON mode (`enact -t session`); map `PolicySpec` to session/keychain limits; sign via viem `token.transferSync` or CLI. **Risks:** passkey `init` is interactive; revoke CLI TBD. **Status:** stub — proceed with CLI + viem hybrid.

### `sponge` (M3)

**Enforcement:** TBD (off-chain-signing or smart-contract). **Surface:** SDK + dashboard (confirm Tempo Moderato `42431` at implementation). **Risks:** docs/signup required before SDK surface is known. **Status:** stub — blocked until M3 signup confirms API.

### `privy` (M4)

**Enforcement:** off-chain-signing. **Surface:** server wallet API (app ID + secret). **Risks:** policy evaluated at sign time — fail-open test applies. **Status:** stub.

### `turnkey` (M4)

**Enforcement:** off-chain-signing. **Surface:** policy engine + org API keys. **Risks:** same fail-open semantics as Privy; revocation = policy/wallet disable analogue. **Status:** stub.
