/**
 * Enact — protocol layer via Tempo access keys (session agent key from enact init).
 * Requires AGENT_PRIVATE_KEY + AGENT_ROOT_ADDRESS; OWNER_PRIVATE_KEY must fund the root.
 */
import type { Address, Hex } from 'viem';
import { getAddress, isAddressEqual } from 'viem';
import { requireOwnerKey } from '../chain/client.js';
import type {
  PolicySpec,
  TransferOutcome,
  TransferRequest,
  WalletAdapter,
} from '../types.js';
import { AccessKeyAgent } from './shared/access-key-agent.js';

const INTEGRATION_LINE_COUNT = 95;
const MANUAL_STEP_COUNT = 2;

function requireAgentKey(): Hex {
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!key?.startsWith('0x')) {
    throw new Error('AGENT_PRIVATE_KEY required — run `enact init` and copy .env values');
  }
  return key as Hex;
}

function requireRootAddress(): Address {
  const addr = process.env.AGENT_ROOT_ADDRESS;
  if (!addr?.startsWith('0x')) {
    throw new Error('AGENT_ROOT_ADDRESS required — from `enact init`');
  }
  return getAddress(addr);
}

export class EnactAdapter implements WalletAdapter {
  readonly name = 'enact';
  readonly enforcementLayer = 'protocol' as const;
  readonly integrationLineCount = INTEGRATION_LINE_COUNT;
  readonly manualStepCount = MANUAL_STEP_COUNT;

  private agent!: AccessKeyAgent;

  async setup(): Promise<void> {
    this.agent = new AccessKeyAgent({
      ownerPrivateKey: requireOwnerKey(),
      agentPrivateKey: requireAgentKey(),
    });
    await this.agent.setup();
    const root = requireRootAddress();
    if (!isAddressEqual(root, this.agent.rootAddress)) {
      throw new Error(
        `AGENT_ROOT_ADDRESS (${root}) must match OWNER_PRIVATE_KEY address (${this.agent.rootAddress}) for headless benchmark runs`,
      );
    }
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
