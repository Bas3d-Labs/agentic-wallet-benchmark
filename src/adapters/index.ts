import type { WalletAdapter } from '../types.js';
import { EnactAdapter } from './enact.js';
import { PrivyAdapter } from './privy.js';
import { SpongeAdapter } from './sponge.js';
import { TempoAccessKeysAdapter } from './tempo-access-keys.js';
import { TurnkeyAdapter } from './turnkey.js';

const ADAPTER_FACTORIES: Record<string, () => WalletAdapter> = {
  'tempo-access-keys': () => new TempoAccessKeysAdapter(),
  enact: () => new EnactAdapter(),
  sponge: () => new SpongeAdapter(),
  privy: () => new PrivyAdapter(),
  turnkey: () => new TurnkeyAdapter(),
};

export function getAllAdapterNames(): string[] {
  return Object.keys(ADAPTER_FACTORIES);
}

export function getAllAdapters(): WalletAdapter[] {
  return getAllAdapterNames().map((name) => createAdapter(name));
}

export function createAdapter(name: string): WalletAdapter {
  const factory = ADAPTER_FACTORIES[name];
  if (!factory) throw new Error(`Unknown adapter: ${name}`);
  return factory();
}

export function getAdaptersByName(names: string[]): WalletAdapter[] {
  return names.map((name) => createAdapter(name));
}

export { TempoAccessKeysAdapter } from './tempo-access-keys.js';
