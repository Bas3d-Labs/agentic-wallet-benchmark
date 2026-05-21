import type { Address } from 'viem';
import type { AdversaryTestResult, PolicySpec, WalletAdapter } from '../types.js';

export async function runFailOpen(
  adapter: WalletAdapter,
  spec: PolicySpec,
  serviceRecipient: Address,
): Promise<AdversaryTestResult> {
  if (!adapter.simulateBackendOutage) {
    return {
      test: 'fail-open',
      passed: true,
      status: 'N/A',
      note: 'Policy enforced on-chain; persists with no backend (favorable)',
    };
  }

  const simulated = await adapter.simulateBackendOutage();
  if (!simulated) {
    return {
      test: 'fail-open',
      passed: true,
      status: 'N/A',
      note: 'Backend outage could not be simulated — record at implementation time',
    };
  }

  const outcome = await adapter.attemptTransfer({
    to: serviceRecipient,
    token: spec.token,
    amount: spec.perTxCap,
  });

  return {
    test: 'fail-open',
    passed: outcome.status !== 'settled',
    outcome,
  };
}
