/**
 * Copy forge output into contracts/artifacts for TypeScript + CI (out/ is gitignored).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const contractsDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'contracts');
const src = join(contractsDir, 'out/Intermediary.sol/Intermediary.json');
const destDir = join(contractsDir, 'artifacts');
const dest = join(destDir, 'Intermediary.json');

const full = JSON.parse(readFileSync(src, 'utf8'));
const slim = {
  abi: full.abi,
  bytecode: { object: full.bytecode.object },
};
mkdirSync(destDir, { recursive: true });
writeFileSync(dest, `${JSON.stringify(slim, null, 2)}\n`);
console.log(`Synced ${dest}`);
