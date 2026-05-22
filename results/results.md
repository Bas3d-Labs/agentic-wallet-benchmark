# Agentic Wallet Benchmark Results
**Network:** Tempo testnet (Moderato)
**Chain ID:** 42431
**Block:** 18715530
**Run:** 2026-05-22T08:59:45.443Z
**Commit:** `86be2a7ae95ce048936b2819323f56bfb1228f42`
> Observed measurements on Tempo testnet (Moderato). Not production deployments.
## Summary
| Wallet | Enforcement | Policy survival | Revocation (ms) | Setup friction (ms) |
|--------|-------------|-----------------|-----------------|---------------------|
| tempo-access-keys | protocol | 25.0% ⚠️ | 1839 | 5627 |
## Per-test detail
### tempo-access-keys
- **within-policy**: PASS
  - In-policy transfer settled
- **cap-split**: PASS
  - 2 in-window transfer(s) settled, overflow blocked
- **allowlist-evasion**: FAIL
- **fail-open**: N/A
  - Policy enforced on-chain; persists with no backend (favorable)
**Documented limitations (tempo access keys):**
- **no-per-tx-cap** (confirmed): expected `settled`, observed `settled`
  - No separate per-tx spending limit
- **window-not-per-tx** (confirmed): expected `settled`, observed `settled`
  - Window cap without per-tx cap
- **allowlist-not-enforced** (confirmed): expected `settled`, observed `settled`
  - Allowlist not enforced without call scopes
- **allowlist-forward-settlement** (confirmed): expected `settled`, observed `settled`
  - Forward to immutable evil via allowlisted intermediary