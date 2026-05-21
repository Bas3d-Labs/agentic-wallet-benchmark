import { defineChain } from 'viem';
import { parseUnits, type Address } from 'viem';

/** Tempo testnet (Moderato) — chain 42431 */
export const CHAIN = defineChain({
  id: 42431,
  name: 'Tempo Moderato',
  nativeCurrency: { name: 'PathUSD', symbol: 'pathUSD', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc.moderato.tempo.xyz'] },
    public: { http: ['https://rpc.moderato.tempo.xyz'] },
  },
  blockExplorers: {
    default: {
      name: 'Tempo Explorer',
      url: 'https://explore.testnet.tempo.xyz',
    },
  },
});

export const CHAIN_ID = CHAIN.id;
export const RPC_URL =
  process.env.TEMPO_RPC_URL ?? 'https://rpc.moderato.tempo.xyz';
export const EXPLORER_URL = 'https://explore.testnet.tempo.xyz';

/** Primary testnet stablecoin — https://tokenlist.tempo.xyz/list/42431 */
export const PATH_USD: Address = '0x20c0000000000000000000000000000000000000';

/** Adversary recipient — set same value when deploying Intermediary. */
export const DEFAULT_EVIL_ADDRESS: Address =
  '0x00000000000000000000000000000000000000E7';

/** AccountKeychain precompile */
export const ACCOUNT_KEYCHAIN: Address =
  '0xAAAAAAAA00000000000000000000000000000000';

/** v0 reference policy — pathUSD, 6 decimals */
export const REFERENCE_POLICY = {
  token: PATH_USD,
  perTxCap: parseUnits('10', 6),
  windowCap: parseUnits('25', 6),
  windowPeriodSeconds: 86_400,
  allowlist: [] as Address[],
} as const;

export const REVOCATION_TIMEOUT_MS = 30_000;
export const REVOCATION_POLL_MS = 500;

export const OWNER_FUND_AMOUNT = parseUnits('500', 6);
export const AGENT_FUND_AMOUNT = parseUnits('100', 6);
