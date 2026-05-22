/**
 * Tempo access keys (protocol baseline)
 * Enforcement: protocol — AccountKeychain precompile.
 */
import type { Address } from 'viem';
import { AGENT_FUND_AMOUNT } from '../config.js';
import { createTempoWalletClient, requireOwnerKey } from '../chain/client.js';
import type {
  PolicySpec,
  TransferOutcome,
  TransferRequest,
  WalletAdapter,
} from '../types.js';
import { AccessKeyAgent } from './shared/access-key-agent.js';

const INTEGRATION_LINE_COUNT = 120;
const MANUAL_STEP_COUNT = 0;

export class TempoAccessKeysAdapter implements WalletAdapter {
  readonly name = 'tempo-access-keys';
  readonly enforcementLayer = 'protocol' as const;
  readonly integrationLineCount = INTEGRATION_LINE_COUNT;
  readonly manualStepCount = MANUAL_STEP_COUNT;

  private agent = new AccessKeyAgent({ ownerPrivateKey: requireOwnerKey() });

  async setup(): Promise<void> {
    await this.agent.setup();
  }

  async fund(token: Address, amount: bigint): Promise<void> {
    await this.agent.fund(token, amount);
  }

  async setPolicy(spec: PolicySpec): Promise<void> {
    await this.agent.setPolicy(spec);
  }

  async attemptTransfer(req: TransferRequest): Promise<TransferOutcome> {
    return this.agent.attemptTransfer(req);
  }

  async revokeAgent(): Promise<void> {
    await this.agent.revokeAgent();
  }

  agentAddress(): Address {
    return this.agent.agentAddress;
  }
}

export async function fundOwnerFromFaucet(): Promise<void> {
  const client = createTempoWalletClient(requireOwnerKey());
  const account = client.account?.address;
  if (!account) return;
  try {
    await client.faucet.fundSync({ account });
  } catch {
    console.warn(`Faucet fund skipped for ${account} — ensure owner is funded`);
  }
}

export async function ensureAgentFunded(
  adapter: TempoAccessKeysAdapter,
  token: Address,
): Promise<void> {
  await adapter.fund(token, AGENT_FUND_AMOUNT);
}
