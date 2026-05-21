/**
 * Tempo access keys (protocol baseline)
 *
 * Enforcement: protocol — AccountKeychain precompile, native spend limits + call scopes.
 * Manual steps: 0 (headless owner key + faucet)
 */
import { encodeFunctionData } from 'viem';
import type { Address } from 'viem';
import {
  Account,
  Expiry,
  P256,
  Period,
  tempoActions,
} from 'viem/tempo';
import { AGENT_FUND_AMOUNT } from '../config.js';
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

const INTEGRATION_LINE_COUNT = 200;
const MANUAL_STEP_COUNT = 0;

export class TempoAccessKeysAdapter implements WalletAdapter {
  readonly name = 'tempo-access-keys';
  readonly enforcementLayer = 'protocol' as const;
  readonly integrationLineCount = INTEGRATION_LINE_COUNT;
  readonly manualStepCount = MANUAL_STEP_COUNT;

  private ownerKey = requireOwnerKey();
  private ownerClient = createTempoWalletClient(this.ownerKey);
  private publicClient = createTempoPublicClient();
  private accessKeyAccount!: ReturnType<typeof Account.fromP256>;
  private approveSelector = 'approve(address,uint256)' as const;

  async setup(): Promise<void> {
    const privateKey = P256.randomPrivateKey();
    const root = this.ownerClient.account;
    if (!root) throw new Error('Owner client missing account');
    this.accessKeyAccount = Account.fromP256(privateKey, { access: root });
  }

  async fund(token: Address, amount: bigint): Promise<void> {
    await this.ownerClient.token.transferSync({
      token,
      to: this.accessKeyAccount.address,
      amount,
    });
  }

  async setPolicy(spec: PolicySpec): Promise<void> {
    const scopes: {
      address: Address;
      selector: string;
      recipients?: Address[];
    }[] = [
      {
        address: spec.token,
        selector: 'transfer(address,uint256)',
        recipients: spec.allowlist.length > 0 ? spec.allowlist : undefined,
      },
    ];

    for (const addr of spec.allowlist) {
      if (addr.toLowerCase() === spec.token.toLowerCase()) continue;
      scopes.push({
        address: addr,
        selector: 'depositAndForward(address,uint256)',
      });
      scopes.push({
        address: spec.token,
        selector: this.approveSelector,
        recipients: [addr],
      });
    }

    await this.ownerClient.accessKey.authorizeSync({
      accessKey: this.accessKeyAccount,
      expiry: Expiry.days(30),
      limits: [
        { token: spec.token, limit: spec.perTxCap },
        {
          token: spec.token,
          limit: spec.windowCap,
          period: Period.seconds(spec.windowPeriodSeconds),
        },
      ],
      scopes,
    });
  }

  async attemptTransfer(req: TransferRequest): Promise<TransferOutcome> {
    const start = Date.now();
    try {
      if (req.forwardTo) {
        await this.ensureIntermediaryApproval(req.token, req.to, req.amount);
        const data = encodeIntermediaryForward(req.token, req.amount);
        const hash = await this.ownerClient.sendTransaction({
          account: this.accessKeyAccount,
          to: req.to,
          data,
        });
        const receipt = await this.publicClient.waitForTransactionReceipt({
          hash,
        });
        if (receipt.status === 'reverted') {
          return { status: 'blocked', reason: 'transaction reverted' };
        }
        return {
          status: 'settled',
          txHash: hash,
          latencyMs: Date.now() - start,
        };
      }

      const { receipt } = await this.ownerClient.token.transferSync({
        account: this.accessKeyAccount,
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
      const message = err instanceof Error ? err.message : String(err);
      if (isPolicyRejection(message)) {
        return { status: 'blocked', reason: message };
      }
      return { status: 'error', error: message };
    }
  }

  private async ensureIntermediaryApproval(
    token: Address,
    intermediary: Address,
    amount: bigint,
  ): Promise<void> {
    const approveData = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'approve',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ type: 'bool' }],
        },
      ],
      functionName: 'approve',
      args: [intermediary, amount],
    });
    await this.ownerClient.sendTransaction({
      account: this.accessKeyAccount,
      to: token,
      data: approveData,
    });
  }

  async revokeAgent(): Promise<void> {
    await this.ownerClient.accessKey.revokeSync({
      accessKey: this.accessKeyAccount,
    });
  }

  agentAddress(): Address {
    return this.accessKeyAccount.address;
  }
}

function isPolicyRejection(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('limit') ||
    lower.includes('scope') ||
    lower.includes('unauthorized') ||
    lower.includes('not authorized') ||
    lower.includes('recipient') ||
    lower.includes('revert')
  );
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
