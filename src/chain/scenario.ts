import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address } from 'viem';
import { REFERENCE_POLICY } from '../config.js';
import type { PolicySpec } from '../types.js';
import { getIntermediaryAddress } from './client.js';

let svcRecipient: Address | undefined;

import { DEFAULT_EVIL_ADDRESS } from '../config.js';

/** Fixed across runs — must match Intermediary deploy constructor arg. */
export function getAdversaryRecipient(): Address {
  const env = process.env.EVIL_ADDRESS;
  if (env?.startsWith('0x')) return env as Address;
  return DEFAULT_EVIL_ADDRESS;
}

export function getServiceRecipient(): Address {
  if (!svcRecipient) {
    svcRecipient = privateKeyToAccount(generatePrivateKey()).address;
  }
  return svcRecipient;
}

export function getReferencePolicySpec(): PolicySpec {
  return {
    ...REFERENCE_POLICY,
    allowlist: [getServiceRecipient()],
  };
}

export function getScenarioAddresses() {
  return {
    serviceRecipient: getServiceRecipient(),
    adversaryRecipient: getAdversaryRecipient(),
    intermediary: getIntermediaryAddress(),
  };
}
