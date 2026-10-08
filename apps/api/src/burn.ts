import { createHash } from 'node:crypto';

/**
 * Burn CPU for roughly `ms`, WITHOUT blocking the event loop.
 *
 * This matters more than it looks. Node is single-threaded: a naive
 * `while (Date.now() < end) {}` stops /health responding, the ALB marks the
 * target unhealthy, and the ASG terminates a perfectly good server. Under
 * sustained load that becomes an endless instance-replacement cycle.
 *
 * Yielding every 5ms keeps health checks answerable while still pegging CPU.
 */
export async function burn(ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const slice = Math.min(Date.now() + 5, end);
    while (Date.now() < slice) {
      createHash('sha256').update(String(Math.random())).digest();
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
}
