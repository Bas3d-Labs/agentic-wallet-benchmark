/**
 * Privy server wallet — M4
 * Enforcement: off-chain-signing
 */
import { StubAdapter } from './stub.js';

export class PrivyAdapter extends StubAdapter {
  readonly name = 'privy';
  readonly enforcementLayer = 'off-chain-signing';
  readonly manualStepCount = 3;

  async simulateBackendOutage(): Promise<boolean> {
    this.notImplemented('simulateBackendOutage');
  }
}
