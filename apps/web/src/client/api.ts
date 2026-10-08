import type { ConfigResponse, MeResponse, PostKind, PostsResponse, StressResponse } from '@campuswall/shared';

/** Stable per-browser id. The SERVER maps it to a display name; we never pick one. */
export function sessionId(): string {
  const KEY = 'campuswall.session';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const getPosts = () => jsonFetch<PostsResponse>('/api/posts');
export const getConfig = () => jsonFetch<ConfigResponse>('/api/config');
export const getClientConfig = () => jsonFetch<{ showStress: boolean }>('/api/client-config');

export const createPost = (kind: PostKind, idx: number) =>
  jsonFetch<{ id: number; served_by: string }>('/api/posts', {
    method: 'POST',
    body: JSON.stringify({ kind, idx, session: sessionId() }),
  });

export const stress = () => jsonFetch<StressResponse>('/api/stress', { method: 'POST' });

/** Claims this browser's display name on first call; stable thereafter. */
export const getMe = () =>
  jsonFetch<MeResponse>('/api/me', { method: 'POST', body: JSON.stringify({ session: sessionId() }) });

/** Remember the name so the UI has something to show before the API answers. */
const NAME_KEY = 'campuswall.name';
export const cachedName = () => {
  try { return localStorage.getItem(NAME_KEY); } catch { return null; }
};
export const rememberName = (name: string) => {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* private mode */ }
};

/**
 * Stable colour per instance, drawn from the iOS system palette.
 *
 * Deliberately not a random hue: arbitrary HSL produces muddy, clashing
 * colours. A short curated list stays legible against white and keeps the
 * chips looking like part of one system.
 */
const TINTS = [
  '#007aff', // blue
  '#ff9500', // orange
  '#34c759', // green
  '#af52de', // purple
  '#ff2d55', // pink
  '#30b0c7', // teal
  '#5856d6', // indigo
  '#ff3b30', // red
];

export function instanceColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 9)}…` : id);
