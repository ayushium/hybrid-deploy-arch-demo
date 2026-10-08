export type PostKind = 'preset' | 'emoji';

export interface Post {
  id: number;
  kind: PostKind;
  /** 0..4 — an index into PRESETS or EMOJIS, never a string the user typed. */
  idx: number;
  /** Server-assigned display name, unique per session, e.g. "PacketPirate". */
  nick: string;
  served_by: string;
  az: string;
  created_at: string;
}

/** Every response carries the identity of the machine that produced it. */
export interface ServerStamp {
  /** EC2 instance id, e.g. "i-0a3f2b9c1d4e5f6a7". */
  served_by: string;
  /** Availability zone, e.g. "ap-south-1b". */
  az: string;
  /** Seconds since this process started. */
  uptime_s: number;
}

export interface PostsResponse extends ServerStamp {
  posts: Post[];
}

export interface HealthResponse extends ServerStamp {
  status: 'ok' | 'degraded';
  db: boolean;
}

export interface ConfigResponse extends ServerStamp {
  stressEnabled: boolean;
  burnMs: number;
}

export interface StressResponse extends ServerStamp {
  burned_ms: number;
}

export interface MeResponse extends ServerStamp {
  /** Server-assigned display name. Stable for the lifetime of the session. */
  name: string;
}

export interface CreatePostBody {
  kind: PostKind;
  idx: number;
  session: string;
}
