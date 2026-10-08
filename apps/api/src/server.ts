import http from 'node:http';
import { burn } from './burn.ts';
import { dbHealthy, initSchema, insertPost, listPosts } from './db.ts';
import { resolveIdentity, stamp } from './identity.ts';
import { nameFor } from './names.ts';
import { BadRequest, clampBurnMs, DEFAULT_BURN_MS, parsePost } from './validate.ts';

const PORT = Number(process.env.PORT ?? 3000);
const STRESS_ENABLED = process.env.STRESS_ENABLED === 'true';

/** Requests served by this process — powers the activity meter. */
let served = 0;

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    // The Worker proxies server-side, so this is not strictly needed; keep
    // it permissive so hitting the ALB directly with curl still works.
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
  });
  res.end(payload);
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw new BadRequest('body too large');
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new BadRequest('invalid json');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;
  served++;

  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
      });
      return res.end();
    }

    // ---- health: the ALB target group hits this every 10s -----------------
    // It MUST check the database. An instance that can't reach RDS is not
    // healthy, however cheerfully the process is still running.
    if (path === '/health') {
      const db = await dbHealthy();
      return json(res, db ? 200 : 503, { status: db ? 'ok' : 'degraded', db, ...stamp() });
    }

    // ---- stamp only, no DB: for the round-robin curl loop -----------------
    if (path === '/api/whoami') {
      return json(res, 200, { ...stamp(), served });
    }

    if (path === '/api/config') {
      return json(res, 200, { stressEnabled: STRESS_ENABLED, burnMs: DEFAULT_BURN_MS, ...stamp() });
    }

    if (path === '/api/posts' && req.method === 'GET') {
      return json(res, 200, { posts: await listPosts(50), ...stamp() });
    }

    // Who am I? Claims a name on first contact, then returns the same one.
    if (path === '/api/me' && req.method === 'POST') {
      const body = (await readJson(req)) as Record<string, unknown>;
      const session = String(body.session ?? '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session)) {
        throw new BadRequest('session must be a uuid');
      }
      return json(res, 200, { name: await nameFor(session), ...stamp() });
    }

    if (path === '/api/posts' && req.method === 'POST') {
      const { kind, idx, session } = parsePost(await readJson(req));
      const id = await resolveIdentity();
      const insertedId = await insertPost({
        kind,
        idx,
        nick: await nameFor(session),
        served_by: id.served_by,
        az: id.az,
      });
      return json(res, 201, { id: insertedId, ...stamp() });
    }

    // ---- the stress button ------------------------------------------------
    // Hiding the button in the UI is not turning the feature off. This check
    // is the one that actually does anything.
    if (path === '/api/stress' && req.method === 'POST') {
      if (!STRESS_ENABLED) return json(res, 403, { error: 'stress disabled' });
      const ms = clampBurnMs(url.searchParams.get('ms'));
      await burn(ms);
      return json(res, 200, { burned_ms: ms, ...stamp() });
    }

    return json(res, 404, { error: 'not found' });
  } catch (err) {
    if (err instanceof BadRequest) return json(res, 400, { error: err.message });
    console.error('[api] unhandled', err);
    return json(res, 500, { error: 'internal error' });
  }
});

/**
 * Keep trying to create the schema, in the background.
 *
 * Crashing when the database isn't up yet would be wrong twice over: an
 * instance can boot before RDS finishes provisioning, and systemd would then
 * restart-loop us forever. Instead we start listening straight away and let
 * /health report `degraded` — the ALB simply won't route to this instance
 * until the DB answers, which is exactly the behaviour we want.
 */
async function initSchemaWithRetry(): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await initSchema();
      console.log('[api] schema ready');
      return;
    } catch (err) {
      const wait = Math.min(1000 * 2 ** (attempt - 1), 30_000);
      console.error(`[api] schema attempt ${attempt} failed, retrying in ${wait}ms`,
        err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function main(): Promise<void> {
  const id = await resolveIdentity();
  void initSchemaWithRetry();
  server.listen(PORT, () => {
    console.log(`[api] ${id.served_by} (${id.az}) listening on :${PORT}  stress=${STRESS_ENABLED}`);
  });
}

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    console.log(`[api] ${sig} — draining`);
    server.close(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
