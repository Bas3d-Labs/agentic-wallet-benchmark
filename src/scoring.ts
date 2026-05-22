import type { AdapterRunResult, BenchmarkResults } from './types.js';

export function computePolicySurvivalRate(run: AdapterRunResult): number {
  let blocked = 0;
  let total = 0;

  for (const test of run.tests) {
    if (test.status === 'N/A' || test.test === 'within-policy') continue;

    if (test.test === 'cap-split') {
      total += 1;
      if (test.passed) blocked += 1;
      continue;
    }

    if (test.test === 'allowlist-evasion' && test.subResults) {
      for (const sub of Object.values(test.subResults)) {
        if (sub.expected === 'blocked') {
          total += 1;
          if (
            sub.outcome.status === 'blocked' ||
            sub.outcome.status === 'error'
          ) {
            blocked += 1;
          }
        }
      }
      continue;
    }

    if (test.test === 'fail-open') {
      total += 1;
      if (test.passed) blocked += 1;
    }
  }

  if (total === 0) return 1;
  return blocked / total;
}

export function buildScores(
  adapters: AdapterRunResult[],
): BenchmarkResults['scores'] {
  const scores: BenchmarkResults['scores'] = {};
  for (const run of adapters) {
    scores[run.adapter] = {
      policySurvivalRate: computePolicySurvivalRate(run),
      revocationLatencyMs: run.revocationLatencyMs,
      setupFrictionMs: run.setupFrictionMs,
      enforcementLayer: run.enforcementLayer,
    };
  }
  return scores;
}
