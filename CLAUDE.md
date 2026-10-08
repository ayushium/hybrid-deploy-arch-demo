# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A reference implementation of a **hybrid deployment architecture**: a React frontend on
Cloudflare Workers (edge) and a Node API on EC2 behind an ALB and Auto Scaling Group, with
MySQL on RDS in a private subnet.

It is a **teaching repository**. Its purpose is to make infrastructure behaviour observable —
load balancing, autoscaling, health checks and instance failure are all visible in the UI.
Optimise for clarity over cleverness. A reader learning AWS should be able to follow every
file.

## Commands

```bash
pnpm install          # run once; commit pnpm-lock.yaml (CI uses --frozen-lockfile)
pnpm dev              # MySQL + 3 API instances + local LB + Vite
pnpm dev:solo         # one API on :3000, less terminal noise
pnpm dev:edge         # wrangler dev — the real Worker; run before any deploy
pnpm build            # build all packages
pnpm typecheck        # same check CI runs
pnpm db:up / db:down  # MySQL container
```

No test runner is configured. Verify changes by running `pnpm dev` and exercising the
endpoints.

## Layout

| Path | Role |
|---|---|
| `packages/shared/src/content.ts` | The 5 presets + 5 emojis. Single source of truth. |
| `packages/shared/src/types.ts` | API contract, imported by **both** apps. |
| `apps/api/src/` | Node API. `node:http` only, one runtime dep (`mysql2`). |
| `apps/web/src/worker.ts` | Edge proxy: HTTPS in, HTTP to the ALB server-side. |
| `apps/web/src/client/` | React. `Phone.tsx` (client view), `Wall.tsx` (display view). |
| `infra/local-lb.mjs` | Round-robin proxy standing in for the ALB. Local only. |
| `infra/user-data.sh` | EC2 Launch Template bootstrap. |
| `docs/` | Architecture, local development, AWS setup, deployment. |

`packages/shared` is consumed two ways: Vite aliases it to **source** so edits hot-reload;
the API imports the **built** `dist`. That is why the API build is
`pnpm --filter "@campuswall/api..." build` — the `...` includes shared but skips React,
Vite and Wrangler.

## Invariants — do not break these

1. **The API has exactly one runtime dependency (`mysql2`).** Every extra dependency is
   another way for an EC2 instance to fail during boot. Use the Node standard library.
   Do not introduce Express, Fastify, an ORM or a validation library.

2. **`burn()` must yield to the event loop.** Node is single-threaded. A blocking loop stops
   `/health` responding, the ALB marks the instance unhealthy, and the ASG terminates a
   working server. See `apps/api/src/burn.ts` — hash in ~5ms slices with
   `await new Promise(setImmediate)` between them. This is load-bearing, not a style choice.

3. **`/health` must query the database.** An instance that cannot reach RDS is not healthy,
   however cheerfully the process is still running.

4. **Never store user-supplied text.** `kind` is an enum and `idx` is `0..4`; the database
   holds an enum and a small integer. Display names come from the fixed `NAMES` list and are
   assigned server-side. Adding a free-text field would change the security model — don't.

   **Uniqueness is delegated to `AUTO_INCREMENT`.** `sessions.seq` gives each session a
   distinct number and the name is a pure function of it (`nameForSeq`). Do not replace this
   with a hash of the session id: with 100 names and ~30 participants the birthday paradox
   makes a collision about 99% likely. Do not add locking or retry loops either — the
   database already guarantees this.

5. **Validate server-side, always.** The buttons constrain the UI; `apps/api/src/validate.ts`
   is what actually enforces the contract. Anyone can call the ALB directly.

6. **The client polls; it does not use WebSockets.** A sticky connection pins each client to
   one instance and hides load balancing, which is the thing this repo exists to show.

7. **The API must not crash when the database is unavailable.** It listens immediately and
   retries the schema with backoff; `/health` reports `degraded` until the DB answers. An
   instance can boot before RDS is ready, and a crash loop is worse than a degraded one.

8. **Identity resolves once at startup and is cached.** Never call IMDS per request.

## Deployment

**Deployment is a push to `main`.** Never run `wrangler`, `aws`, `ssh` or `scp` against real
infrastructure from a local machine, and do not suggest it. GitHub Actions runs CI, then
deploys only the half that changed — `packages/shared/**` counts as both.

Environment-specific values live in `apps/web/wrangler.jsonc` (`ALB_HOST`, `SHOW_STRESS`), so
changing configuration is a commit. The EC2 fleet is updated by SSM Run Command targeted at
the ASG tag, authenticated with GitHub OIDC — there are no stored AWS keys.

## Conventions

- TypeScript throughout, ESM, `.js` extensions on relative imports (NodeNext).
- Comments explain **why**, especially where a naive implementation would break
  infrastructure behaviour. Keep those comments; they are the point of the repo.
- No presentation, workshop or teaching-session material in this repository — only
  engineering documentation.
