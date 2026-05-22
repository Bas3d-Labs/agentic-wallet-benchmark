import type { TransferOutcome } from '../../types.js';

export function isOutOfGas(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('out of gas') ||
    lower.includes('intrinsic gas too low') ||
    (lower.includes('gas') && lower.includes('exhausted'))
  );
}

/** Viem-estimated gas (~553k) OOGs on access-key transfers; benchmark uses 1.5M+. */
export function isLikelyRpcGasUnderbudget(message: string): boolean {
  const match = message.match(/gas:\s+(\d+)/i);
  if (!match) return false;
  return BigInt(match[1]) < 800_000n;
}

export function isPolicyRejection(message: string): boolean {
  if (isOutOfGas(message) || isLikelyRpcGasUnderbudget(message)) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('spendinglimitexceeded') ||
    lower.includes('spending limit') ||
    lower.includes('keychain') ||
    lower.includes('scope') ||
    lower.includes('unauthorized') ||
    lower.includes('not authorized') ||
    lower.includes('recipient') ||
    lower.includes('denied') ||
    lower.includes('not allowed') ||
    lower.includes('policy') ||
    lower.includes('insufficientallowance') ||
    lower.includes('tip20 token error') ||
    lower.includes('reverted')
  );
}

export function outcomeFromError(err: unknown): TransferOutcome {
  const message = err instanceof Error ? err.message : String(err);
  if (isPolicyRejection(message)) {
    return { status: 'blocked', reason: message };
  }
  return { status: 'error', error: message };
}

export function isRetriableMempoolError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('replacement transaction underpriced') ||
    message.includes('nonce too low') ||
    message.includes('already known')
  );
}

export async function retryOnMempool<T>(
  fn: () => Promise<T>,
  maxAttempts = 4,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetriableMempoolError(err) || attempt === maxAttempts - 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw new Error('retryOnMempool: unreachable');
}

export function formatTokenAmount(amount: bigint, decimals = 6): string {
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const frac = amount % base;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
}
