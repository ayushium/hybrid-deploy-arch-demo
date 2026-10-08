interface Env {
  ASSETS: Fetcher;
  ALB_HOST: string;
  SHOW_STRESS: string;
  BURN_MS: string;
}

/**
 * The edge half.
 *
 * The browser only ever talks to this Worker, over HTTPS. The Worker's own
 * fetch() reaches the ALB over plain HTTP, server-side — which is why this
 * architecture needs no custom domain, no ACM certificate, no CORS preflight
 * and hits no mixed-content block.
 *
 * This is also the natural home for rate limiting, auth and caching: work
 * done here costs nothing, work done on EC2 is billed by the hour.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Client config is resolved at the edge so the button can be revealed
    // with a commit, without redeploying or restarting the API.
    if (url.pathname === '/api/client-config') {
      return Response.json({ showStress: env.SHOW_STRESS === 'true' });
    }

    // How hard /api/stress works is edge config, so it can be retuned with a
    // commit instead of a new launch template and an instance replacement.
    // An explicit ?ms= still wins, and the API clamps whatever arrives.
    if (url.pathname === '/api/stress' && !url.searchParams.has('ms') && env.BURN_MS) {
      url.searchParams.set('ms', env.BURN_MS);
    }

    if (url.pathname.startsWith('/api/')) {
      const target = `http://${env.ALB_HOST}${url.pathname}${url.search}`;
      try {
        const upstream = await fetch(target, {
          method: request.method,
          headers: { 'content-type': 'application/json' },
          body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
        });
        const body = await upstream.text();
        return new Response(body, {
          status: upstream.status,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        });
      } catch {
        // The origin is down — say so clearly rather than serving a blank page.
        return Response.json({ error: 'origin unreachable', alb: env.ALB_HOST }, { status: 502 });
      }
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
