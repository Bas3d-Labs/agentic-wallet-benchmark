/**
 * Sponge — M3
 * See METHODOLOGY.md (Adapter status).
 */
import { StubAdapter } from './stub.js';

export class SpongeAdapter extends StubAdapter {
  readonly name = 'sponge';
  readonly enforcementLayer = 'unknown';
  readonly manualStepCount = 1;
}
