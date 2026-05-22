export const ADAPTER_ENV: Record<string, string[]> = {
  'tempo-access-keys': ['OWNER_PRIVATE_KEY', 'INTERMEDIARY_ADDRESS'],
  enact: [
    'OWNER_PRIVATE_KEY',
    'INTERMEDIARY_ADDRESS',
    'AGENT_PRIVATE_KEY',
    'AGENT_ROOT_ADDRESS',
  ],
  sponge: ['OWNER_PRIVATE_KEY', 'INTERMEDIARY_ADDRESS', 'SPONGE_API_KEY'],
  privy: [
    'OWNER_PRIVATE_KEY',
    'INTERMEDIARY_ADDRESS',
    'PRIVY_APP_ID',
    'PRIVY_APP_SECRET',
  ],
  turnkey: [
    'OWNER_PRIVATE_KEY',
    'INTERMEDIARY_ADDRESS',
    'TURNKEY_API_PUBLIC_KEY',
    'TURNKEY_API_PRIVATE_KEY',
    'TURNKEY_ORGANIZATION_ID',
    'TURNKEY_SIGN_WITH',
  ],
};

export function assertAdapterCredentials(adapterNames: string[]): void {
  const missing: string[] = [];
  for (const name of adapterNames) {
    const keys = ADAPTER_ENV[name];
    if (!keys) {
      throw new Error(`Unknown adapter: ${name}`);
    }
    for (const key of keys) {
      if (!process.env[key]) missing.push(`${name}: ${key}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing credentials for benchmark run:\n${missing.map((m) => `  - ${m}`).join('\n')}\nSee .env.example`,
    );
  }
}
