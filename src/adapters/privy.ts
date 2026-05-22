/**
 * Privy server wallet — off-chain-signing on Tempo (CAIP-2 eip155:42431).
 */
import { PrivyClient } from '@privy-io/node';
import { createViemAccount } from '@privy-io/node/viem';
import { encodeFunctionData } from 'viem';
import type { Address, Hex } from 'viem';
import { tempoActions } from 'viem/tempo';
import { createWalletClient, http } from 'viem';
import { CHAIN, CHAIN_ID, RPC_URL } from '../config.js';
import {
  createTempoPublicClient,
  createTempoWalletClient,
  encodeIntermediaryForward,
  requireOwnerKey,
} from '../chain/client.js';
import type {
  PolicySpec,
  TransferOutcome,
  TransferRequest,
  WalletAdapter,
} from '../types.js';
import { formatTokenAmount, outcomeFromError } from './shared/transfer-utils.js';

const INTEGRATION_LINE_COUNT = 175;
const MANUAL_STEP_COUNT = 3;
export class PrivyAdapter implements WalletAdapter {
  readonly name = 'privy';
  readonly enforcementLayer = 'off-chain-signing' as const;
  readonly integrationLineCount = INTEGRATION_LINE_COUNT;
  readonly manualStepCount = MANUAL_STEP_COUNT;

  private client!: PrivyClient;
  private walletId!: string;
  private walletAddress!: Address;
  private policyId!: string;
  private publicClient = createTempoPublicClient();
  private outageBaseUrl: string | undefined;

  async setup(): Promise<void> {
    const appId = process.env.PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error('PRIVY_APP_ID and PRIVY_APP_SECRET are required');
    }
    this.client = new PrivyClient({
      appId,
      appSecret,
      apiUrl: process.env.PRIVY_API_URL,
    });
    const wallet = await this.client.wallets().create({
      chain_type: 'ethereum',
    });
    this.walletId = wallet.id;
    this.walletAddress = wallet.address as Address;
  }

  async fund(token: Address, amount: bigint): Promise<void> {
    const owner = createTempoWalletClient(requireOwnerKey());
    await owner.token.transferSync({
      token,
      to: this.walletAddress,
      amount,
    });
  }

  async setPolicy(spec: PolicySpec): Promise<void> {
    const allowlist = spec.allowlist.map((a) => a.toLowerCase());
    const policy = await this.client.policies().create({
      chain_type: 'ethereum',
      name: `benchmark-${Date.now()}`,
      version: '1.0',
      rules: [
        {
          name: 'allowlist-destinations',
          method: 'eth_sendTransaction',
          action: 'ALLOW',
          conditions: [
            {
              field: 'to',
              field_source: 'ethereum_transaction',
              operator: 'in',
              value: allowlist,
            },
            {
              field: 'chain_id',
              field_source: 'ethereum_transaction',
              operator: 'eq',
              value: String(CHAIN_ID),
            },
          ],
        },
        {
          name: 'per-tx-cap',
          method: 'transfer',
          action: 'ALLOW',
          conditions: [
            {
              field: 'amount',
              field_source: 'action_request_body',
              operator: 'lte',
              value: formatTokenAmount(spec.perTxCap),
            },
          ],
        },
      ],
    });
    this.policyId = policy.id;
    await this.client.wallets().update(this.walletId, {
      policy_ids: [this.policyId],
    });
    void spec.windowCap;
  }

  async attemptTransfer(req: TransferRequest): Promise<TransferOutcome> {
    const start = Date.now();
    try {
      const account = createViemAccount(this.client, {
        walletId: this.walletId,
        address: this.walletAddress,
      });
      const client = createWalletClient({
        account,
        chain: CHAIN,
        transport: http(RPC_URL),
      }).extend(tempoActions());

      if (req.forwardTo) {
        const data = encodeIntermediaryForward(req.token, req.amount);
        const hash = await client.sendTransaction({
          to: req.to,
          data,
        });
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === 'reverted') {
          return { status: 'blocked', reason: 'transaction reverted' };
        }
        return { status: 'settled', txHash: hash, latencyMs: Date.now() - start };
      }

      const { receipt } = await client.token.transferSync({
        token: req.token,
        to: req.to,
        amount: req.amount,
      });
      return {
        status: 'settled',
        txHash: receipt.transactionHash,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return outcomeFromError(err);
    }
  }

  async revokeAgent(): Promise<void> {
    await this.client.policies()._delete(this.policyId);
  }

  async simulateBackendOutage(): Promise<boolean> {
    this.outageBaseUrl = process.env.PRIVY_API_URL;
    process.env.PRIVY_API_URL = 'http://127.0.0.1:9';
    this.client = new PrivyClient({
      appId: process.env.PRIVY_APP_ID!,
      appSecret: process.env.PRIVY_APP_SECRET!,
      apiUrl: process.env.PRIVY_API_URL,
    });
    return true;
  }

  agentAddress(): Address {
    return this.walletAddress;
  }
}
