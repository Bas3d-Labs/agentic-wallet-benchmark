/**
 * Enact — M3
 * Enforcement: protocol (expected). See METHODOLOGY.md (Adapter status).
 */
import { StubAdapter } from './stub.js';

export class EnactAdapter extends StubAdapter {
  readonly name = 'enact';
  readonly enforcementLayer = 'unknown';
  readonly manualStepCount = 2;
}
