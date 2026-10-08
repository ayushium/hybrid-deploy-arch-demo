import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type ViteDevServer } from 'vite';

/**
 * In production `/api/client-config` is answered by the Worker, not the API.
 * Vite proxies everything under /api to the load balancer, so without this the
 * endpoint 404s locally and the stress button could never appear. Registering
 * the middleware directly (not in a returned callback) puts it ahead of the
 * proxy.
 */
const clientConfig = {
  name: 'client-config',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/api/client-config', (_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ showStress: process.env.SHOW_STRESS === 'true' }));
    });

    // Mirror the Worker's BURN_MS injection so dev and production behave the
    // same. Registered before the proxy, so the rewritten URL is what travels.
    server.middlewares.use((req, _res, next) => {
      if (req.url?.startsWith('/api/stress') && !req.url.includes('ms=') && process.env.BURN_MS) {
        req.url += (req.url.includes('?') ? '&' : '?') + `ms=${process.env.BURN_MS}`;
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), clientConfig],
  resolve: {
    alias: {
      // Point at source, not dist, so edits to the shared package hot-reload.
      '@campuswall/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  build: { outDir: 'dist/client', emptyOutDir: true },
  server: {
    port: 5173,
    // In dev the local round-robin proxy stands in for the ALB.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
