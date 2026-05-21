import type { PolicySpec, AdversaryTestResult, WalletAdapter } from '../types.js';

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

  const blocked = outcomes.some((o) => o.status === 'blocked');
  return {
    test: 'cap-split',
    passed: blocked,
    outcomes,
  };
}
