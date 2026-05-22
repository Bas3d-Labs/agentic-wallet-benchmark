/**
 * Sponge — off-chain-signing (agent API + enforced transfers).
 * Requires SPONGE_API_KEY; optional SPONGE_MASTER_KEY to recreate agents per setup.
 */
import { SpongePlatform, SpongeWallet } from '@paysponge/sdk';
import { encodeFunctionData } from 'viem';
import type { Address } from 'viem';
import { CHAIN_ID } from '../config.js';
import { requireOwnerKey, createTempoWalletClient } from '../chain/client.js';
import type { TransactionResult } from '@paysponge/sdk';
import type {
  PolicySpec,
  TransferOutcome,
  TransferRequest,
  WalletAdapter,
} from '../types.js';
import {
  formatTokenAmount,
  isPolicyRejection,
  outcomeFromError,
} from './shared/transfer-utils.js';
import { encodeIntermediaryForward } from '../chain/client.js';

const INTEGRATION_LINE_COUNT = 150;
const MANUAL_STEP_COUNT = 2;

export class SpongeAdapter implements WalletAdapter {
  readonly name = 'sponge';
  readonly enforcementLayer = 'off-chain-signing' as const;
  readonly integrationLineCount = INTEGRATION_LINE_COUNT;
  readonly manualStepCount = MANUAL_STEP_COUNT;

  private wallet!: SpongeWallet;
  private agentId!: string;
  private platformBaseUrl?: string;
  private outageSimulated = false;

  async setup(): Promise<void> {
    const apiKey = process.env.SPONGE_API_KEY;
    if (!apiKey) throw new Error('SPONGE_API_KEY is required');

    const masterKey = process.env.SPONGE_MASTER_KEY;
    if (masterKey) {
      const platform = await SpongePlatform.connect({ apiKey: masterKey });
      this.platformBaseUrl = platform.getBaseUrl();
      const { agent, apiKey: agentKey } = await platform.createAgent({
        name: `benchmark-${Date.now()}`,
        isTestMode: true,
      });
      this.agentId = agent.id;
      this.wallet = await platform.connectAgent({ apiKey: agentKey, agentId: agent.id });
    } else {
      this.wallet = await SpongeWallet.connect({ apiKey, testnet: true });
      this.agentId = 'default';
    }
  }

  async fund(token: Address, amount: bigint): Promise<void> {
    const owner = createTempoWalletClient(requireOwnerKey());
    const to = await this.wallet.getAddress('tempo');
    if (!to) throw new Error('Sponge tempo address unavailable');
    await owner.token.transferSync({ token, to: to as Address, amount });
  }

  async setPolicy(spec: PolicySpec): Promise<void> {
    const masterKey = process.env.SPONGE_MASTER_KEY;
    if (!masterKey) return;

    const platform = await SpongePlatform.connect({ apiKey: masterKey });
    // Sponge API field name; value is the benchmark rolling window cap.
    const windowLimit = formatTokenAmount(spec.windowCap);
    await platform.setFleetSpendingLimits({
      agentIds: [this.agentId],
      dailySpendingLimit: windowLimit,
    });
    await platform.updateAgent(this.agentId, {
      dailySpendingLimit: windowLimit,
    });

    for (const addr of spec.allowlist) {
      await this.postAllowlist(addr);
    }
  }

  private async postAllowlist(address: Address): Promise<void> {
    const baseUrl = this.platformBaseUrl;
    const apiKey = process.env.SPONGE_MASTER_KEY ?? process.env.SPONGE_API_KEY;
    if (!baseUrl || !apiKey) return;
    await fetch(`${baseUrl}/api/allowlist/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        agentId: this.agentId,
        chainId: CHAIN_ID,
        address,
        label: 'benchmark',
      }),
    });
  }

  async attemptTransfer(req: TransferRequest): Promise<TransferOutcome> {
    const start = Date.now();
    try {
      if (req.forwardTo) {
        const data = encodeIntermediaryForward(req.token, req.amount);
        const tx = await (
          this.wallet as SpongeWallet & {
            sendTransaction(o: {
              chain: string;
              to: string;
              value: string;
              data: string;
            }): Promise<TransactionResult>;
          }
        ).sendTransaction({
          chain: 'tempo',
          to: req.to,
          value: '0',
          data,
        });
        return this.mapTx(tx, start);
      }

      const tx = await this.wallet.transfer({
        chain: 'tempo',
        to: req.to,
        amount: formatTokenAmount(req.amount),
        currency: 'pathUSD',
      });
      return this.mapTx(tx, start);
    } catch (err) {
      return outcomeFromError(err);
    }
  }

  private mapTx(
    tx: { status?: string; txHash?: string; transactionHash?: string; message?: string },
    start: number,
  ): TransferOutcome {
    const hash = (tx.txHash ?? tx.transactionHash) as `0x${string}` | undefined;
    const status = (tx.status ?? '').toLowerCase();
    if (
      status.includes('fail') ||
      status.includes('reject') ||
      status.includes('block') ||
      (tx.message && isPolicyRejection(tx.message))
    ) {
      return { status: 'blocked', reason: tx.message ?? status };
    }
    if (!hash) {
      return { status: 'error', error: tx.message ?? 'missing transaction hash' };
    }
    return { status: 'settled', txHash: hash, latencyMs: Date.now() - start };
  }

  async revokeAgent(): Promise<void> {
    const masterKey = process.env.SPONGE_MASTER_KEY;
    if (!masterKey) {
      throw new Error('SPONGE_MASTER_KEY required for revokeAgent');
    }
    const platform = await SpongePlatform.connect({ apiKey: masterKey });
    await platform.updateAgent(this.agentId, { dailySpendingLimit: '0' });
  }

  async simulateBackendOutage(): Promise<boolean> {
    if (this.outageSimulated) return true;
    globalThis.fetch = async () => {
      throw new Error('simulated Sponge API outage');
    };
    this.outageSimulated = true;
    return true;
  }

  agentAddress(): Address {
    const cached = this.wallet.address('tempo');
    return cached as Address;
  }
}
