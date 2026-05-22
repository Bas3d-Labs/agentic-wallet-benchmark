import type { Address } from 'viem';
import { AGENT_FUND_AMOUNT } from '../config.js';
import type {
  AdversaryTestResult,
  PolicySpec,
  SubAttemptResult,
  WalletAdapter,
} from '../types.js';

export async function runAllowlistEvasion(
  adapter: WalletAdapter,
  spec: PolicySpec,
  evil: Address,
  intermediary: Address,
): Promise<AdversaryTestResult> {
  const a = await runSubAttempt(adapter, 'a', 'blocked', {
    to: evil,
    token: spec.token,
    amount: spec.perTxCap,
  });

  const b = await runSubAttempt(adapter, 'b', 'blocked', {
    to: intermediary,
    token: spec.token,
    amount: spec.perTxCap,
  });

  // New access key — revoked keys cannot be re-authorized on Tempo.
  await adapter.setup();
  await adapter.fund(spec.token, AGENT_FUND_AMOUNT);
  let c: SubAttemptResult;
  try {
    await adapter.setPolicy({
      ...spec,
      allowlist: [...spec.allowlist, intermediary],
      scopeContracts: [intermediary],
      useCallScopes: true,
    });
    c = await runSubAttempt(adapter, 'c', 'blocked', {
    to: intermediary,
    token: spec.token,
    amount: spec.perTxCap,
      forwardTo: evil,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    c = {
      id: 'c',
      expected: 'blocked',
      outcome: { status: 'error', error: `setPolicy failed: ${message}` },
    };
  }

  return {
    test: 'allowlist-evasion',
    passed: subPassed(a) && subPassed(b) && subPassed(c),
    subResults: { a, b, c },
  };
}

async function runSubAttempt(
  adapter: WalletAdapter,
  id: string,
  expected: 'blocked' | 'settled',
  req: Parameters<WalletAdapter['attemptTransfer']>[0],
): Promise<SubAttemptResult> {
  const outcome = await adapter.attemptTransfer(req);
  return { id, expected, outcome };
}

function subPassed(sub: SubAttemptResult): boolean {
  return sub.expected === 'blocked'
    ? sub.outcome.status === 'blocked'
    : sub.outcome.status === 'settled';
}
