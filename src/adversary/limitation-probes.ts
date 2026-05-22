import type { Address } from 'viem';
import { AGENT_FUND_AMOUNT } from '../config.js';
import type {
  LimitationProbeResult,
  PolicySpec,
  TransferOutcome,
  WalletAdapter,
} from '../types.js';

/**
 * Probes that document known gaps for protocol access-key adapters (tempo baseline).
 * A probe passes when on-chain behavior matches the documented limitation.
 */
export async function runTempoLimitationProbes(
  adapter: WalletAdapter,
  spec: PolicySpec,
  serviceRecipient: Address,
  intermediary: Address,
  evil: Address,
): Promise<LimitationProbeResult[]> {
  return [
    await probeNoPerTxCap(adapter, spec, serviceRecipient),
    await probeMidWindowAbovePerTxRef(adapter, spec, serviceRecipient),
    await probeAllowlistNotEnforced(adapter, spec, evil),
    await probeAllowlistForwardSettlement(
      adapter,
      spec,
      intermediary,
      evil,
    ),
  ];
}

async function probeNoPerTxCap(
  adapter: WalletAdapter,
  spec: PolicySpec,
  serviceRecipient: Address,
): Promise<LimitationProbeResult> {
  const overCap = spec.perTxCap + 1_000_000n;
  const outcome = await withFreshPolicy(adapter, spec, () =>
    adapter.attemptTransfer({
      to: serviceRecipient,
      token: spec.token,
      amount: overCap,
    }),
  );

  return buildProbe({
    id: 'no-per-tx-cap',
    title: 'No separate per-tx spending limit',
    description:
      'Reference policy defines a 10 pathUSD per-tx cap, but AccountKeychain allows one limit per token (rolling window only). A transfer one unit above per-tx cap but under the window cap can settle.',
    expectedOutcome: 'settled',
    outcome,
  });
}

async function probeMidWindowAbovePerTxRef(
  adapter: WalletAdapter,
  spec: PolicySpec,
  serviceRecipient: Address,
): Promise<LimitationProbeResult> {
  const amount = spec.perTxCap * 2n;
  const outcome = await withFreshPolicy(adapter, spec, () =>
    adapter.attemptTransfer({
      to: serviceRecipient,
      token: spec.token,
      amount,
    }),
  );

  return buildProbe({
    id: 'window-not-per-tx',
    title: 'Window cap without per-tx cap',
    description:
      'A single transfer larger than the reference per-tx cap (20 pathUSD) but below the rolling window cap (25) can settle because only the window limit is enforced on-chain.',
    expectedOutcome: 'settled',
    outcome,
  });
}

async function probeAllowlistNotEnforced(
  adapter: WalletAdapter,
  spec: PolicySpec,
  evil: Address,
): Promise<LimitationProbeResult> {
  const outcome = await withFreshPolicy(adapter, spec, () =>
    adapter.attemptTransfer({
      to: evil,
      token: spec.token,
      amount: spec.perTxCap,
    }),
  );

  return buildProbe({
    id: 'allowlist-not-enforced',
    title: 'Allowlist not enforced without call scopes',
    description:
      'Reference policy lists only SVC, but setPolicy omits call scopes (required for working TIP-20 transfers on Moderato). Paying EVIL directly can settle.',
    expectedOutcome: 'settled',
    outcome,
  });
}

async function probeAllowlistForwardSettlement(
  adapter: WalletAdapter,
  spec: PolicySpec,
  intermediary: Address,
  evil: Address,
): Promise<LimitationProbeResult> {
  const outcome = await withFreshAgent(adapter, spec, async () => {
    await adapter.setPolicy({
      ...spec,
      allowlist: [intermediary],
      scopeContracts: [intermediary],
      useCallScopes: true,
    });
    return adapter.attemptTransfer({
      to: intermediary,
      token: spec.token,
      amount: spec.perTxCap,
      forwardTo: evil,
    });
  });

  return buildProbe({
    id: 'allowlist-forward-settlement',
    title: 'Forward to immutable evil via allowlisted intermediary',
    description:
      'Sub-test (c) with intermediary allowlisted and depositAndForward scoped. If this settles, only the immediate recipient was checked and EVIL (Intermediary.forwardTo) received funds. Blocked means stronger enforcement or insufficient allowance.',
    expectedOutcome: 'settled',
    outcome,
  });
}

async function withFreshAgent(
  adapter: WalletAdapter,
  spec: PolicySpec,
  fn: () => Promise<TransferOutcome>,
): Promise<TransferOutcome> {
  await adapter.setup();
  await adapter.fund(spec.token, AGENT_FUND_AMOUNT);
  return fn();
}

async function withFreshPolicy(
  adapter: WalletAdapter,
  spec: PolicySpec,
  fn: () => Promise<TransferOutcome>,
): Promise<TransferOutcome> {
  return withFreshAgent(adapter, spec, async () => {
    await adapter.setPolicy(spec);
    return fn();
  });
}

function buildProbe(args: {
  id: string;
  title: string;
  description: string;
  expectedOutcome: 'blocked' | 'settled';
  outcome: TransferOutcome;
}): LimitationProbeResult {
  const observed =
    args.outcome.status === 'settled'
      ? 'settled'
      : args.outcome.status === 'blocked'
        ? 'blocked'
        : 'error';
  return {
    id: args.id,
    title: args.title,
    description: args.description,
    expectedOutcome: args.expectedOutcome,
    observed,
    outcome: args.outcome,
    limitationConfirmed: observed === args.expectedOutcome,
  };
}
