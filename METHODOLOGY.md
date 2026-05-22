# Methodology

**Network:** Tempo testnet (Moderato) · **Chain ID:** 42431  
Results are observed measurements on testnet — not production deployments.

## Reference policy

| Field | v0 value |
|-------|----------|
| Token | pathUSD (`0x20c0000000000000000000000000000000000000`) |
| Per-tx cap | 10 pathUSD |
| Window cap | 25 pathUSD / 5-minute rolling window |
| Allowlist | Service recipient `SVC` only (plus intermediary for sub-test c) |

Wallet adapters translate this `PolicySpec` into each provider's primitives. Token-level TIP-403 policies are out of scope for v0.

## Scenario addresses

- **SVC** — ephemeral allowlisted service payee (generated per run)
- **EVIL** — fixed address (`EVIL_ADDRESS` env), never allowlisted
- **Intermediary** — deployed contract; `depositAndForward` pulls from agent and forwards to `EVIL`

Deploy Intermediary with `EVIL` as constructor arg so on-chain forward target matches the harness.

## Adversary tests

### 0. Within policy (positive control)

One transfer of `perTxCap` to **SVC** on a fresh agent.  
**Pass:** **settled**. **Fail:** blocked or error (wallet unusable for legitimate spend).  
Recorded in results; excluded from policy survival rate. Setup friction is measured through this transfer.

### 1. Cap split

`n = floor(windowCap / perTxCap) + 1` transfers of `perTxCap` to **SVC**.  
**Pass:** the first `n - 1` transfers **settle** and the `n`th is **blocked** (window cap enforced without blocking all traffic).  
**Fail:** all `n` settle, or fewer than `n - 1` settle before the overflow attempt.

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

### Tempo access keys — documented limitations (probes)

Run only for `tempo-access-keys` after adversary tests. A probe **confirms** a limitation when on-chain behavior matches the documented gap (does not affect policy survival).

| Probe | What it shows |
|-------|----------------|
| `no-per-tx-cap` | Transfer `perTxCap + 1` to **SVC** settles (no separate per-tx limit; one limit per token) |
| `window-not-per-tx` | Single transfer of `2 × perTxCap` (20 pathUSD) to **SVC** settles (window only) |
| `allowlist-not-enforced` | Pay **EVIL** directly settles when call scopes are omitted (limits-only policy) |
| `allowlist-forward-settlement` | Allowlisted intermediary + `depositAndForward` forwards to immutable **EVIL** |

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
3. Fixed test order: within-policy (during setup) → cap-split → allowlist-evasion → fail-open; tempo limitation probes after adversary tests.
4. Provider-specific logic stays inside adapters only.

## Caveats

- Fail-open is architectural when signing and policy share one service — document per adapter.
- Revocation semantics differ (key revoke vs policy delete vs wallet disable) — closest analogue documented per adapter.
- Enact/Sponge may require interactive signup — manual steps count toward setup friction, not benchmark scores.

## Adapter status

Condensed from internal integration research (maintained outside this repo).

### `tempo-access-keys` (baseline)

Implemented. **Enforcement:** protocol (AccountKeychain). Headless owner key + faucet; fail-open N/A.  
**Note:** The keychain allows one spending limit per token; the adapter maps the reference policy to a **5-minute rolling window cap** (`windowCap`). Transfers use `perTxCap` amounts; per-tx enforcement is not a separate on-chain limit. **Call scopes** for allowlist enforcement are opt-in (`useCallScopes`); the default harness path uses limits-only because scoped TIP-20 transfers revert on Moderato today (see limitation probes).

### `enact`

Implemented. **Enforcement:** protocol via Enact session agent key (`AGENT_PRIVATE_KEY`) authorized by root (`AGENT_ROOT_ADDRESS` must match `OWNER_PRIVATE_KEY`). **Revoke:** access key revoke on-chain. **Manual:** `enact init` (passkey) before first run.

### `sponge`

Implemented. **Enforcement:** off-chain-signing (`@paysponge/sdk`). **Policy:** fleet/agent spending limits + allowlist REST when `SPONGE_MASTER_KEY` set. **Revoke:** zero daily limit via platform API. **Fail-open:** simulated fetch outage.

### `privy`

Implemented. **Enforcement:** off-chain-signing (`@privy-io/node` + viem tempo). **Policy:** Privy policy rules on `eth_sendTransaction` / `transfer`. **Revoke:** delete policy. **Fail-open:** invalid `PRIVY_API_URL`.

### `turnkey`

Implemented. **Enforcement:** off-chain-signing (Turnkey policy engine + `@turnkey/viem`). **Policy:** `createPolicy` with `tempo.tx` conditions. **Revoke:** `deletePolicy`. **Requires:** pre-created `TURNKEY_SIGN_WITH` key in org.
