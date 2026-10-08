import { EMOJIS, PRESETS, type CreatePostBody, type PostKind } from '@campuswall/shared';

export class BadRequest extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The actual safety mechanism.
 *
 * The buttons are UI, and UI is not security — anyone can curl the ALB
 * directly. Only an allowlist stops the wall being defaced, so nothing the
 * client sends is ever stored as text: just an enum and a small integer.
 */
export function parsePost(raw: unknown): CreatePostBody {
  const b = (raw ?? {}) as Record<string, unknown>;

  const kind: PostKind | null =
    b.kind === 'emoji' ? 'emoji' : b.kind === 'preset' ? 'preset' : null;
  if (!kind) throw new BadRequest('kind must be "preset" or "emoji"');

  const idx = Number(b.idx);
  const max = kind === 'emoji' ? EMOJIS.length : PRESETS.length;
  if (!Number.isInteger(idx) || idx < 0 || idx >= max) {
    throw new BadRequest(`idx must be an integer in 0..${max - 1}`);
  }

  const session = String(b.session ?? '');
  if (!UUID.test(session)) throw new BadRequest('session must be a uuid');

  return { kind, idx, session };
}

/**
 * How long a press of the stress button burns for.
 *
 * The real value is edge configuration — `BURN_MS` in `apps/web/wrangler.jsonc`,
 * which the Worker appends as `?ms=`. That keeps it retunable with a commit
 * rather than a launch template edit. This constant is only the floor for
 * someone calling the ALB directly with no parameter.
 */
export const DEFAULT_BURN_MS = 500;
const MAX_BURN_MS = 2000;

/** Clamp so a hand-crafted request can't park an instance for a minute. */
export function clampBurnMs(raw: unknown): number {
  const ms = Number(raw);
  return Math.min(Math.max(Number.isFinite(ms) ? ms : DEFAULT_BURN_MS, 0), MAX_BURN_MS);
}
