import { NAMES } from '@campuswall/shared';
import { sessionSeq } from './db.ts';

/**
 * Display names are ASSIGNED by the server and are UNIQUE.
 *
 * Uniqueness is delegated entirely to AUTO_INCREMENT: each session gets a
 * distinct sequence number, and the name is a pure function of that number.
 * No locking, no retry loop, no duplicate-key handling — the database was
 * always going to be better at this than we are.
 *
 * That matters because several EC2 instances hand out names concurrently and
 * none of them can see the others' memory. Hashing the session id instead
 * would be simpler still, but with 100 names and 30 participants the birthday
 * paradox makes a collision ~99% likely.
 *
 * 37 is coprime with 100, so (seq * 37) % 100 walks the whole list before
 * repeating — the order looks arbitrary but never collides. Past 100 sessions
 * the pool wraps and names gain a suffix: "Nebula 2", "Nebula 3".
 */
const STRIDE = 37;

export function nameForSeq(seq: number): string {
  const n = seq - 1;                                  // seq is 1-based
  const name = NAMES[(n * STRIDE) % NAMES.length];
  const round = Math.floor(n / NAMES.length);
  return round === 0 ? name : `${name} ${round + 1}`;
}

/** Per-process cache; the database remains the source of truth. */
const cache = new Map<string, string>();

export async function nameFor(session: string): Promise<string> {
  const hit = cache.get(session);
  if (hit) return hit;
  const name = nameForSeq(await sessionSeq(session));
  cache.set(session, name);
  return name;
}
