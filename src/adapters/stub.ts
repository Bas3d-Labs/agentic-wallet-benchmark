import type { PolicySpec, TransferOutcome, TransferRequest, WalletAdapter } from '../types.js';

export abstract class StubAdapter implements WalletAdapter {
  abstract readonly name: string;
  abstract readonly enforcementLayer: WalletAdapter['enforcementLayer'];
  readonly integrationLineCount = 0;
  readonly manualStepCount: number = 0;

  protected notImplemented(action: string): never {
    throw new Error(
      `${this.name} adapter: ${action} not implemented yet — see METHODOLOGY.md (Adapter status)`,
    );
  }

  async setup(): Promise<void> {
    this.notImplemented('setup');
  }

  async fund(): Promise<void> {
    this.notImplemented('fund');
  }

  async setPolicy(_spec: PolicySpec): Promise<void> {
    this.notImplemented('setPolicy');
  }

  async attemptTransfer(_req: TransferRequest): Promise<TransferOutcome> {
    this.notImplemented('attemptTransfer');
  }

  async revokeAgent(): Promise<void> {
    this.notImplemented('revokeAgent');
  }

  agentAddress(): `0x${string}` {
    this.notImplemented('agentAddress');
  }
}
