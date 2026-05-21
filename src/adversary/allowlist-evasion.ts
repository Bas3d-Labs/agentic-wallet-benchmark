import type { Address } from 'viem';
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

  await adapter.setPolicy({
    ...spec,
    allowlist: [...spec.allowlist, intermediary],
  });

  const c = await runSubAttempt(adapter, 'c', 'blocked', {
    to: intermediary,
    token: spec.token,
    amount: spec.perTxCap,
    forwardTo: evil,
  });

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
