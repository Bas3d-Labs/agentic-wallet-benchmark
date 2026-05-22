import { encodeFunctionData, getAddress } from 'viem';
import type { Address, Hex } from 'viem';
import { Account, Expiry, P256, Period } from 'viem/tempo';
import {
  ACCESS_KEY_AUTHORIZE_GAS,
  ACCESS_KEY_TRANSFER_GAS,
} from '../../config.js';
import {
  createTempoPublicClient,
  createTempoWalletClient,
  encodeIntermediaryForward,
} from '../../chain/client.js';
import type { PolicySpec, TransferOutcome, TransferRequest } from '../../types.js';
import { outcomeFromError, retryOnMempool } from './transfer-utils.js';

export type AccessKeyAgentOptions = {
  ownerPrivateKey: Hex;
  /** If set, reuse this P256 agent key instead of generating a new one per setup. */
  agentPrivateKey?: Hex;
};

export class AccessKeyAgent {
  readonly ownerClient;
  readonly publicClient;
  private accessKeyAccount!: ReturnType<typeof Account.fromP256>;

  constructor(private readonly options: AccessKeyAgentOptions) {
    this.ownerClient = createTempoWalletClient(options.ownerPrivateKey);
    this.publicClient = createTempoPublicClient();
  }

  async setup(): Promise<void> {
    const root = this.ownerClient.account;
    if (!root) throw new Error('Owner client missing account');
    const agentKey = this.options.agentPrivateKey ?? P256.randomPrivateKey();
    this.accessKeyAccount = Account.fromP256(agentKey, { access: root });
  }

  get agentAddress(): Address {
    return this.accessKeyAccount.address;
  }

  get rootAddress(): Address {
    const root = this.ownerClient.account;
    if (!root) throw new Error('Owner client missing account');
    return root.address;
  }

  async fund(token: Address, amount: bigint): Promise<void> {
    await retryOnMempool(() =>
      this.ownerClient.token.transferSync({
        token,
        to: this.accessKeyAccount.address,
        amount,
      }),
    );
  }

  async setPolicy(spec: PolicySpec): Promise<void> {
    const scopes: {
      address: Address;
      selector: string;
      recipients?: Address[];
    }[] = [];

    if (spec.useCallScopes) {
      const recipients =
        spec.allowlist.length > 0
          ? spec.allowlist.map((a) => getAddress(a))
          : undefined;
      scopes.push({
        address: spec.token,
        selector: 'transfer(address,uint256)',
        recipients,
      });

      for (const addr of spec.scopeContracts ?? []) {
        if (addr.toLowerCase() === spec.token.toLowerCase()) continue;
        scopes.push({
          address: addr,
          selector: 'depositAndForward(address,uint256)',
        });
        scopes.push({
          address: spec.token,
          selector: 'approve(address,uint256)',
          recipients: [getAddress(addr)],
        });
      }
    }

    const authParams = {
      accessKey: this.accessKeyAccount,
      expiry: Expiry.days(30),
      gas: ACCESS_KEY_AUTHORIZE_GAS,
      limits: [
        {
          token: spec.token,
          limit: spec.windowCap,
          period: Period.seconds(spec.windowPeriodSeconds),
        },
      ],
      ...(scopes.length > 0 ? { scopes } : {}),
    };

    await retryOnMempool(() =>
      this.ownerClient.accessKey.authorizeSync(authParams),
    );
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
          gas: ACCESS_KEY_TRANSFER_GAS,
        });
        const receipt = await this.publicClient.waitForTransactionReceipt({
          hash,
        });
        if (receipt.status === 'reverted') {
          return outcomeFromError(new Error(`transaction reverted: ${hash}`));
        }
        return {
          status: 'settled',
          txHash: hash,
          latencyMs: Date.now() - start,
        };
      }

      const { receipt } = await retryOnMempool(() =>
        this.ownerClient.token.transferSync({
          account: this.accessKeyAccount,
          token: req.token,
          to: req.to,
          amount: req.amount,
          gas: ACCESS_KEY_TRANSFER_GAS,
        }),
      );
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
    await this.ownerClient.accessKey.revokeSync({
      accessKey: this.accessKeyAccount,
      gas: ACCESS_KEY_AUTHORIZE_GAS,
    });
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
      gas: ACCESS_KEY_TRANSFER_GAS,
    });
  }
}
