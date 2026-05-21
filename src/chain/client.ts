import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  type Address,
  type Hash,
  type PublicClient,
} from 'viem';
import { Account, tempoActions } from 'viem/tempo';
import { CHAIN, RPC_URL } from '../config.js';

export function createTempoPublicClient(): PublicClient {
  return createPublicClient({
    chain: CHAIN,
    transport: http(RPC_URL),
  });
}

export function createTempoWalletClient(privateKey: `0x${string}`) {
  const account = Account.fromSecp256k1(privateKey);
  return createWalletClient({
    account,
    chain: CHAIN,
    transport: http(RPC_URL),
  }).extend(tempoActions());
}

export function requireOwnerKey(): `0x${string}` {
  const key = process.env.OWNER_PRIVATE_KEY;
  if (!key?.startsWith('0x')) {
    throw new Error('OWNER_PRIVATE_KEY is required (see .env.example)');
  }
  return key as `0x${string}`;
}

export function getIntermediaryAddress(): Address {
  const addr = process.env.INTERMEDIARY_ADDRESS;
  if (!addr?.startsWith('0x')) {
    throw new Error(
      'INTERMEDIARY_ADDRESS is required — deploy contracts/Intermediary.sol and set in .env',
    );
  }
  return addr as Address;
}

export const intermediaryAbi = [
  {
    type: 'function',
    name: 'depositAndForward',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

export function encodeIntermediaryForward(
  token: Address,
  amount: bigint,
): `0x${string}` {
  return encodeFunctionData({
    abi: intermediaryAbi,
    functionName: 'depositAndForward',
    args: [token, amount],
  });
}

export async function waitForTx(
  client: PublicClient,
  hash: Hash,
): Promise<void> {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status === 'reverted') {
    throw new Error(`Transaction reverted: ${hash}`);
  }
}
