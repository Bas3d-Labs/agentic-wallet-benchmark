/**
 * Turnkey policy engine — off-chain-signing on Tempo.
 */
import { Turnkey } from '@turnkey/sdk-server';
import { createAccount } from '@turnkey/viem';
import { tempoActions, withFeePayer } from 'viem/tempo';
import { createClient, http, type Address } from 'viem';
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

type TurnkeyApi = {
  createPolicy: (input: {
    policyName: string;
    effect: string;
    condition?: string;
    consensus?: string;
    notes: string;
  }) => Promise<{
    activity?: { result?: { createPolicyResult?: { policyId: string } } };
  }>;
  deletePolicy: (input: { policyId: string }) => Promise<unknown>;
};

const INTEGRATION_LINE_COUNT = 190;
const MANUAL_STEP_COUNT = 3;

export class TurnkeyAdapter implements WalletAdapter {
  readonly name = 'turnkey';
  readonly enforcementLayer = 'off-chain-signing' as const;
  readonly integrationLineCount = INTEGRATION_LINE_COUNT;
  readonly manualStepCount = MANUAL_STEP_COUNT;

  private sdk!: Turnkey;
  private signWith!: string;
  private policyId!: string;
  private address!: Address;
  private publicClient = createTempoPublicClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tempoClient!: any;

  async setup(): Promise<void> {
    const orgId = process.env.TURNKEY_ORGANIZATION_ID;
    const publicKey = process.env.TURNKEY_API_PUBLIC_KEY;
    const privateKey = process.env.TURNKEY_API_PRIVATE_KEY;
    const signWith = process.env.TURNKEY_SIGN_WITH;
    if (!orgId || !publicKey || !privateKey || !signWith) {
      throw new Error(
        'TURNKEY_ORGANIZATION_ID, TURNKEY_API_PUBLIC_KEY, TURNKEY_API_PRIVATE_KEY, TURNKEY_SIGN_WITH required',
      );
    }
    this.sdk = new Turnkey({
      apiBaseUrl: process.env.TURNKEY_BASE_URL ?? 'https://api.turnkey.com',
      apiPublicKey: publicKey,
      apiPrivateKey: privateKey,
      defaultOrganizationId: orgId,
    });
    this.signWith = signWith;

    const account = await createAccount({
      client: this.sdk.apiClient(),
      organizationId: orgId,
      signWith,
    });
    this.address = account.address;

    this.tempoClient = createClient({
      account,
      chain: CHAIN,
      transport: withFeePayer(
        http(RPC_URL),
        http('https://sponsor.moderato.tempo.xyz'),
      ),
    })
      .extend(tempoActions());
  }

  async fund(token: Address, amount: bigint): Promise<void> {
    const owner = createTempoWalletClient(requireOwnerKey());
    await owner.token.transferSync({
      token,
      to: this.address,
      amount,
    });
  }

  async setPolicy(spec: PolicySpec): Promise<void> {
    const allowlist = spec.allowlist.map((a) => `'${a.toLowerCase()}'`).join(',');
    const condition = [
      `tempo.tx.to in [${allowlist}]`,
      `tempo.tx.amount <= ${spec.perTxCap}`,
    ].join(' && ');

    const activity = await (this.sdk.apiClient() as unknown as TurnkeyApi).createPolicy({
      policyName: `benchmark-${Date.now()}`,
      effect: 'EFFECT_ALLOW',
      condition,
      consensus: 'true',
      notes: `benchmark window cap ${formatTokenAmount(spec.windowCap)}`,
    });
    this.policyId =
      activity.activity?.result?.createPolicyResult?.policyId ?? '';
    if (!this.policyId) {
      throw new Error('Turnkey createPolicy did not return policyId');
    }
    void spec.windowPeriodSeconds;
    void CHAIN_ID;
  }

  async attemptTransfer(req: TransferRequest): Promise<TransferOutcome> {
    const start = Date.now();
    try {
      if (req.forwardTo) {
        const data = encodeIntermediaryForward(req.token, req.amount);
        const hash = await this.tempoClient.sendTransaction({
          to: req.to,
          data,
        });
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === 'reverted') {
          return { status: 'blocked', reason: 'transaction reverted' };
        }
        return { status: 'settled', txHash: hash, latencyMs: Date.now() - start };
      }

      const { receipt } = await this.tempoClient.token.transferSync({
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
    await (this.sdk.apiClient() as unknown as TurnkeyApi).deletePolicy({
      policyId: this.policyId,
    });
  }

  async simulateBackendOutage(): Promise<boolean> {
    this.sdk = new Turnkey({
      apiBaseUrl: 'http://127.0.0.1:9',
      apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
      apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
    });
    return true;
  }

  agentAddress(): Address {
    return this.address;
  }
}
