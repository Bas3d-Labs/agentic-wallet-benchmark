import type { Address, Hash } from 'viem';

export type EnforcementLayer =
  | 'protocol'
  | 'smart-contract'
  | 'off-chain-signing'
  | 'unknown';

export interface PolicySpec {
  token: Address;
  perTxCap: bigint;
  /** Rolling window spend cap (24h in v0). */
  windowCap: bigint;
  /** Window length in seconds (default 86400). */
  windowPeriodSeconds: number;
  allowlist: Address[];
}

export type TransferOutcome =
  | { status: 'settled'; txHash: Hash; latencyMs: number }
  | { status: 'blocked'; reason: string }
  | { status: 'error'; error: string };

/** Agent transfer request — shared shape for all adapters. */
export interface TransferRequest {
  to: Address;
  token: Address;
  amount: bigint;
  /** When paying the intermediary, forward to this address in the same tx (allowlist sub-test c). */
  forwardTo?: Address;
}

export interface WalletAdapter {
  readonly name: string;
  enforcementLayer: EnforcementLayer;

  setup(): Promise<void>;
  fund(token: Address, amount: bigint): Promise<void>;
  setPolicy(spec: PolicySpec): Promise<void>;
  attemptTransfer(req: TransferRequest): Promise<TransferOutcome>;
  revokeAgent(): Promise<void>;
  simulateBackendOutage?(): Promise<boolean>;
  agentAddress(): Address;
  /** Optional line count proxy for setup friction. */
  readonly integrationLineCount?: number;
  /** Manual steps documented in adapter header (dev UX only). */
  readonly manualStepCount?: number;
}

export interface SubAttemptResult {
  id: string;
  expected: 'blocked' | 'settled';
  outcome: TransferOutcome;
}

export interface AdversaryTestResult {
  test: string;
  passed: boolean;
  status?: 'ok' | 'N/A';
  note?: string;
  outcomes?: TransferOutcome[];
  subResults?: Record<string, SubAttemptResult>;
  outcome?: TransferOutcome;
}

export interface AdapterRunResult {
  adapter: string;
  enforcementLayer: EnforcementLayer;
  setupFrictionMs: number;
  integrationLineCount: number;
  manualStepCount: number;
  tests: AdversaryTestResult[];
  revocationLatencyMs: number | null;
}

export interface BenchmarkResults {
  network: string;
  chainId: number;
  blockHeight: string;
  timestamp: string;
  commitHash: string | null;
  policy: PolicySpec;
  scenario: {
    serviceRecipient: Address;
    adversaryRecipient: Address;
    intermediary: Address;
  };
  adapters: AdapterRunResult[];
  scores: Record<
    string,
    {
      policySurvivalRate: number;
      revocationLatencyMs: number | null;
      setupFrictionMs: number;
      enforcementLayer: EnforcementLayer;
    }
  >;
}
