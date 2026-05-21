import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BenchmarkResults } from './types.js';

const RESULTS_DIR = join(process.cwd(), 'results');

export async function writeReport(results: BenchmarkResults): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });
  const jsonPath = join(RESULTS_DIR, 'results.json');
  const mdPath = join(RESULTS_DIR, 'results.md');

  await writeFile(jsonPath, `${JSON.stringify(results, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}\n`);

  const md = renderMarkdown(results);
  await writeFile(mdPath, md);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

function renderMarkdown(results: BenchmarkResults): string {
  const lines: string[] = [
    '# Agentic Wallet Benchmark Results',
    '',
    `**Network:** ${results.network}`,
    `**Chain ID:** ${results.chainId}`,
    `**Block:** ${results.blockHeight}`,
    `**Run:** ${results.timestamp}`,
    results.commitHash ? `**Commit:** \`${results.commitHash}\`` : '',
    '',
    '> Observed measurements on Tempo testnet (Moderato). Not production deployments.',
    '',
    '## Summary',
    '',
    '| Wallet | Enforcement | Policy survival | Revocation (ms) | Setup friction (ms) |',
    '|--------|-------------|-----------------|-----------------|---------------------|',
  ];

  for (const [name, score] of Object.entries(results.scores)) {
    const pct = (score.policySurvivalRate * 100).toFixed(1);
    const flag = score.policySurvivalRate < 1 ? ' ⚠️' : '';
    const rev =
      score.revocationLatencyMs == null
        ? 'timeout'
        : String(score.revocationLatencyMs);
    lines.push(
      `| ${name} | ${score.enforcementLayer} | ${pct}%${flag} | ${rev} | ${score.setupFrictionMs} |`,
    );
  }

  lines.push('', '## Per-test detail', '');
  for (const run of results.adapters) {
    lines.push(`### ${run.adapter}`, '');
    for (const test of run.tests) {
      lines.push(`- **${test.test}**: ${test.status === 'N/A' ? 'N/A' : test.passed ? 'PASS' : 'FAIL'}`);
      if (test.note) lines.push(`  - ${test.note}`);
    }
    lines.push('');
  }

  return lines.filter(Boolean).join('\n');
}
