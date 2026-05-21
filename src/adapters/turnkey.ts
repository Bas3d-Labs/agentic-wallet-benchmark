/**
 * Turnkey policy engine — M4
 * Enforcement: off-chain-signing
 */
import { StubAdapter } from './stub.js';

export class TurnkeyAdapter extends StubAdapter {
  readonly name = 'turnkey';
  readonly enforcementLayer = 'off-chain-signing';
  readonly manualStepCount = 3;

  async simulateBackendOutage(): Promise<boolean> {
    this.notImplemented('simulateBackendOutage');
  }
}
