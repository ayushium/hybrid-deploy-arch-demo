/**
 * An Application Load Balancer in about 30 lines. Local development only.
 *
 * Two behaviours that matter, both copied from the real thing:
 *   1. Round-robin PER REQUEST, not per connection. A real ALB terminates the
 *      client connection and routes each request independently, which is why
 *      the badge on the wall flips even over one keep-alive connection.
 *   2. Health checks every 10s, same interval as the target group.
 *
 * Ctrl-C one API process and this drops it within 10 seconds, so failover
 * and draining behaviour can be exercised locally without any AWS resources.
 */
import http from 'node:http';

const TARGETS = (process.env.TARGETS ?? '3001,3002,3003').split(',').map(Number);
const PORT = Number(process.env.LB_PORT ?? 3000);
// /health checks the database. Set HEALTH_PATH=/api/whoami to work on the UI
// without starting Docker.
const HEALTH_PATH = process.env.HEALTH_PATH ?? '/health';
const healthy = new Set(TARGETS);
let next = 0;

async function checkAll() {
  for (const port of TARGETS) {
    const was = healthy.has(port);
    try {
      const r = await fetch(`http://127.0.0.1:${port}${HEALTH_PATH}`, { signal: AbortSignal.timeout(5000) });
      r.ok ? healthy.add(port) : healthy.delete(port);
    } catch {
      healthy.delete(port);
    }
    const is = healthy.has(port);
    if (was !== is) console.log(`[lb] :${port} ${is ? 'healthy' : 'UNHEALTHY — draining'}`);
  }
}

void checkAll();
setInterval(checkAll, 10_000);

http
  .createServer((req, res) => {
    const pool = [...healthy];
    if (!pool.length) {
      res.writeHead(503, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'no healthy targets' }));
    }
    const port = pool[next++ % pool.length];
    const up = http.request(
      { host: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers },
      (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      },
    );
    up.on('error', () => {
      // Eject immediately on a connection error rather than waiting up to 10s
      // for the next health check — a real ALB does the same.
      if (healthy.delete(port)) console.log(`[lb] :${port} UNHEALTHY — draining (connection refused)`);
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'bad gateway', port }));
    });
    req.pipe(up);
  })
  .listen(PORT, () => console.log(`[lb] local ALB on :${PORT} → ${TARGETS.join(', ')}`));
