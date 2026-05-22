import type {
  PolicySpec,
  AdversaryTestResult,
  TransferOutcome,
  WalletAdapter,
} from '../types.js';

function isBlockedOutcome(outcome: TransferOutcome): boolean {
  return outcome.status === 'blocked' || outcome.status === 'error';
}

export async function runCapSplit(
  adapter: WalletAdapter,
  spec: PolicySpec,
  serviceRecipient: `0x${string}`,
): Promise<AdversaryTestResult> {
  const n = Number(spec.windowCap / spec.perTxCap) + 1;
  const outcomes = [];

  for (let i = 0; i < n; i++) {
    outcomes.push(
      await adapter.attemptTransfer({
        to: serviceRecipient,
        token: spec.token,
        amount: spec.perTxCap,
      }),
    );
  }

  const expectedSettled = n - 1;
  const settledPrefix = outcomes
    .slice(0, expectedSettled)
    .every((o) => o.status === 'settled');
  const last = outcomes[n - 1];
  const lastBlocked = last ? isBlockedOutcome(last) : false;
  const passed = settledPrefix && lastBlocked;

  const settledCount = outcomes.filter((o) => o.status === 'settled').length;
  const blockedCount = outcomes.filter((o) => isBlockedOutcome(o)).length;

  return {
    test: 'cap-split',
    passed,
    outcomes,
    note: passed
      ? `${expectedSettled} in-window transfer(s) settled, overflow blocked`
      : `Expected ${expectedSettled} settled then 1 blocked; got ${settledCount} settled, ${blockedCount} blocked`,
  };
}
