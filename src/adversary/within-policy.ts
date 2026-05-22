import type { PolicySpec, AdversaryTestResult, WalletAdapter } from '../types.js';

/** Positive control: one in-policy transfer to the allowlisted service recipient. */
export async function runWithinPolicy(
  adapter: WalletAdapter,
  spec: PolicySpec,
  serviceRecipient: `0x${string}`,
): Promise<AdversaryTestResult> {
  const outcome = await adapter.attemptTransfer({
    to: serviceRecipient,
    token: spec.token,
    amount: spec.perTxCap,
  });

  return {
    test: 'within-policy',
    passed: outcome.status === 'settled',
    outcome,
    note:
      outcome.status === 'settled'
        ? 'In-policy transfer settled'
        : `Expected settled; got ${outcome.status}`,
  };
}
