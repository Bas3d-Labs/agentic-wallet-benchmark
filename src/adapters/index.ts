import type { WalletAdapter } from '../types.js';
import { EnactAdapter } from './enact.js';
import { PrivyAdapter } from './privy.js';
import { SpongeAdapter } from './sponge.js';
import { TempoAccessKeysAdapter } from './tempo-access-keys.js';
import { TurnkeyAdapter } from './turnkey.js';

export function getAllAdapters(): WalletAdapter[] {
  return [
    new TempoAccessKeysAdapter(),
    new EnactAdapter(),
    new SpongeAdapter(),
    new PrivyAdapter(),
    new TurnkeyAdapter(),
  ];
}

export function getAdaptersByName(names: string[]): WalletAdapter[] {
  const all = getAllAdapters();
  const set = new Set(names);
  const selected = all.filter((a) => set.has(a.name));
  if (selected.length !== names.length) {
    const found = new Set(selected.map((a) => a.name));
    const missing = names.filter((n) => !found.has(n));
    throw new Error(`Unknown adapter(s): ${missing.join(', ')}`);
  }
  return selected;
}

export { TempoAccessKeysAdapter } from './tempo-access-keys.js';
