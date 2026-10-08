import type { ServerStamp } from '@campuswall/shared';

const IMDS = 'http://169.254.169.254/latest';
const STARTED = Date.now();

let cached: { served_by: string; az: string } | null = null;

/**
 * Resolve who we are.
 *
 * Locally: env vars. On EC2: IMDSv2, which requires fetching a token first —
 * a plain GET returns 401 on Amazon Linux 2023.
 *
 * Called once at startup and cached. Never per request.
 */
export async function resolveIdentity(): Promise<{ served_by: string; az: string }> {
  if (cached) return cached;

  if (process.env.INSTANCE_ID) {
    cached = { served_by: process.env.INSTANCE_ID, az: process.env.AZ ?? 'local' };
    return cached;
  }

  try {
    const token = await fetch(`${IMDS}/api/token`, {
      method: 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
      signal: AbortSignal.timeout(2000),
    }).then((r) => r.text());

    const headers = { 'X-aws-ec2-metadata-token': token };
    const [served_by, az] = await Promise.all([
      fetch(`${IMDS}/meta-data/instance-id`, { headers, signal: AbortSignal.timeout(2000) }).then((r) => r.text()),
      fetch(`${IMDS}/meta-data/placement/availability-zone`, { headers, signal: AbortSignal.timeout(2000) }).then((r) => r.text()),
    ]);
    cached = { served_by, az };
  } catch {
    // Not on EC2 and no env override — don't crash, just be honest about it.
    cached = { served_by: `unknown-${process.pid}`, az: 'unknown' };
  }
  return cached;
}

export function stamp(): ServerStamp {
  const id = cached ?? { served_by: 'starting', az: 'unknown' };
  return { ...id, uptime_s: Math.floor((Date.now() - STARTED) / 1000) };
}
