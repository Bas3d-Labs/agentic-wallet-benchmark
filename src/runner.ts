import 'dotenv/config';
import { execSync } from 'node:child_process';
import { PATH_USD, REVOCATION_POLL_MS, REVOCATION_TIMEOUT_MS } from './config.js';
import { runAllowlistEvasion, runCapSplit, runFailOpen } from './adversary/index.js';
import { getAdaptersByName, getAllAdapters } from './adapters/index.js';
import {
  fundOwnerFromFaucet,
  TempoAccessKeysAdapter,
} from './adapters/tempo-access-keys.js';
import { createTempoPublicClient } from './chain/client.js';
import {
  getAdversaryRecipient,
  getReferencePolicySpec,
  getScenarioAddresses,
  getServiceRecipient,
} from './chain/scenario.js';
import { writeReport } from './report.js';
import { buildScores } from './scoring.js';
import type {
  AdapterRunResult,
  AdversaryTestResult,
  BenchmarkResults,
  WalletAdapter,
} from './types.js';
import { AGENT_FUND_AMOUNT, CHAIN_ID } from './config.js';

const REQUIRED_ENV = [
  'OWNER_PRIVATE_KEY',
  'INTERMEDIARY_ADDRESS',
] as const;

function parseArgs(): { adapters: string[] } {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--adapters');
  if (idx >= 0 && args[idx + 1]) {
    return { adapters: args[idx + 1].split(',').map((s) => s.trim()) };
  }
  return { adapters: getAllAdapters().map((a) => a.name) };
}

function assertEnv(): void {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
      throw new Error(`Missing required env: ${key}`);
    }
  }
}

function getCommitHash(): string | null {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

async function prepareAdapter(
  adapter: WalletAdapter,
  spec: ReturnType<typeof getReferencePolicySpec>,
): Promise<number> {
  const start = Date.now();
  await adapter.setup();
  await adapter.fund(spec.token, AGENT_FUND_AMOUNT);
  await adapter.setPolicy(spec);

  const probe = await adapter.attemptTransfer({
    to: getServiceRecipient(),
    token: spec.token,
    amount: spec.perTxCap / 2n || 1n,
  });
  if (probe.status === 'error') {
    throw new Error(
      `${adapter.name}: within-policy probe failed: ${probe.error}`,
    );
  }
  return Date.now() - start;
}

async function runTestsForAdapter(
  adapter: WalletAdapter,
): Promise<AdversaryTestResult[]> {
  const spec = getReferencePolicySpec();
  const evil = getAdversaryRecipient();
  const { intermediary } = getScenarioAddresses();
  const svc = getServiceRecipient();
  const tests: AdversaryTestResult[] = [];

  const order = [
    () => runCapSplit(adapter, spec, svc),
    () => runAllowlistEvasion(adapter, spec, evil, intermediary),
    () => runFailOpen(adapter, spec, svc),
  ] as const;

  for (const run of order) {
    await adapter.setup();
    await adapter.fund(spec.token, AGENT_FUND_AMOUNT);
    await adapter.setPolicy(spec);
    tests.push(await run());
  }

  return tests;
}

async function measureRevocationLatency(
  adapter: WalletAdapter,
): Promise<number | null> {
  const spec = getReferencePolicySpec();
  const svc = getServiceRecipient();

  await adapter.setup();
  await adapter.fund(spec.token, AGENT_FUND_AMOUNT);
  await adapter.setPolicy(spec);

  const revokedAt = Date.now();
  await adapter.revokeAgent();

  const deadline = revokedAt + REVOCATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const outcome = await adapter.attemptTransfer({
      to: svc,
      token: spec.token,
      amount: 1n,
    });
    if (outcome.status === 'blocked' || outcome.status === 'error') {
      return Date.now() - revokedAt;
    }
    await new Promise((r) => setTimeout(r, REVOCATION_POLL_MS));
  }
  return null;
}

async function runAdapter(adapter: WalletAdapter): Promise<AdapterRunResult> {
  console.log(`\n=== ${adapter.name} ===`);
  const spec = getReferencePolicySpec();
  const setupFrictionMs = await prepareAdapter(adapter, spec);
  const tests = await runTestsForAdapter(adapter);
  const revocationLatencyMs = await measureRevocationLatency(adapter);

  return {
    adapter: adapter.name,
    enforcementLayer: adapter.enforcementLayer,
    setupFrictionMs,
    integrationLineCount: adapter.integrationLineCount ?? 0,
    manualStepCount: adapter.manualStepCount ?? 0,
    tests,
    revocationLatencyMs,
  };
}

async function main(): Promise<void> {
  assertEnv();
  const { adapters: adapterNames } = parseArgs();
  const adapters = getAdaptersByName(adapterNames);

  if (adapterNames.includes('tempo-access-keys')) {
    await fundOwnerFromFaucet();
  }

  const publicClient = createTempoPublicClient();
  const blockHeight = await publicClient.getBlockNumber();

  const adapterResults: AdapterRunResult[] = [];
  for (const adapter of adapters) {
    try {
      adapterResults.push(await runAdapter(adapter));
    } catch (err) {
      console.error(`Adapter ${adapter.name} failed:`, err);
      throw err;
    }
  }

  const scenario = getScenarioAddresses();
  const policy = getReferencePolicySpec();

  const results: BenchmarkResults = {
    network: 'Tempo testnet (Moderato)',
    chainId: CHAIN_ID,
    blockHeight: blockHeight.toString(),
    timestamp: new Date().toISOString(),
    commitHash: getCommitHash(),
    policy,
    scenario,
    adapters: adapterResults,
    scores: buildScores(adapterResults),
  };

  await writeReport(results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
