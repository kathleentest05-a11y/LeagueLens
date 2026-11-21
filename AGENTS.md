# LeagueLens — Agent Instructions

Guidance for AI coding agents (and humans) working in this repo. The product
source of truth is [docs/PRD.md](docs/PRD.md); engineering design is
[docs/TDD.md](docs/TDD.md). When code and docs disagree, fix one of them in
the same change — do not let them drift.

## Repo map

```text
frontend/          @leaguelens/frontend — Next.js (App Router) + React + MUI + Tailwind utilities
backend/           @leaguelens/backend — one package, two entrypoints:
  src/api/           GraphQL API (Apollo Server on Express)
  src/worker/        sync worker (the only provider caller)
  src/shared/        backend-shared code (config; later data layer/adapters/alerts)
  prisma/            Prisma schema + migrations (TDD Section 6)
packages/shared/   @leaguelens/shared — TS types/constants + generated GraphQL types
docs/              PRD.md, TDD.md
```

## Commands (run from repo root)

```bash
npm install                 # one install, one lockfile (npm workspaces)
npm run dev                 # web (3000) + api (4000) + worker, host inner-loop
docker compose up --build   # full stack incl. Postgres (demo/CI mode)
npm run build               # codegen, then shared, backend, frontend
npm run typecheck           # tsc across workspaces
npm run lint                # ESLint across workspaces
npm run test                # Vitest across workspaces
npm run codegen             # regenerate packages/shared/src/generated from the SDL
npm run db:migrate -w @leaguelens/backend   # create/apply Prisma migrations (needs Postgres up; explicit step, TDD 10.1)
npm run format              # Prettier (code files; PRD/TDD excluded)
```

Node is pinned by `.nvmrc` (nvm: `nvm install`, `nvm use`). Package manager
is npm — do not introduce yarn/pnpm lockfiles.

## Hard rules (from PRD/TDD; these are not style preferences)

- **Secrets only as env vars.** Never commit credentials, hard-code them, or
  log them. New variables go into the matching `.env.example` (names only)
  in the same change. Server secrets must never get a `NEXT_PUBLIC_` prefix
  or enter client components / `packages/shared`.
- **The browser never calls a provider.** Only the backend worker may call
  Sleeper (plus the API's single connect-time username lookup). API
  resolvers read the normalized database only — no provider passthrough.
  Yahoo (post-M1, M5) follows the same shape: worker-only data calls, with
  the API's only Yahoo exchange being the OAuth callback designed in TDD
  TD-8. Yahoo tokens are never returned by the API or logged; `YAHOO_*`
  config is backend-only and optional (blank = Yahoo disabled). ESPN has
  no milestone — do not build it ahead of Yahoo (PRD Section 6.4).
- **All Sleeper traffic goes through the one adapter + rate limiter**
  (backend, M1). No other code constructs a Sleeper URL. Budget: stay under
  1,000 calls/min per egress IP; operating target in `SLEEPER_RATE_LIMIT_PER_MIN`.
  The same one-adapter rule applies to Yahoo traffic when M5 lands.
- **Provider IDs are strings.** Sleeper IDs exceed JS safe integers; never
  parse them as numbers.
- **Sync upserts, never delete-then-recreate**, keyed on the identity rules
  in TDD Section 6.1, so alert history survives refreshes.
- **Stale or CSV data is never presented as live.** Keep `lastSyncAt`
  visible; CSV leagues keep their "manually imported" labeling.
- **Read-only product.** LeagueLens never writes to a provider (no lineup
  edits on Sleeper). Sleeper data is non-commercial-only — no paywalls,
  billing, or ads in front of it.
- **`packages/shared` is types/constants only.** No DB, network, or
  server-only code. The GraphQL SDL in `backend/src/api/schema.graphql` is
  authoritative; run `npm run codegen` after changing it and commit the
  regenerated types (CI fails on drift).
- **Backend stays one package** (api + worker entrypoints, one image, two
  Compose commands). Do not split it without updating TDD Section 11.
- **No cloud changes in the MVP.** Kubernetes/Terraform artifacts are
  validate-only; never `terraform apply` or point tooling at a real cloud
  account without an explicit budget decision (PRD Section 12).

## Coding standards (enforced by tooling, not prose)

- TypeScript strict everywhere (`tsconfig.base.json`), ESLint flat configs
  per workspace, Prettier formatting. Run `npm run lint`,
  `npm run typecheck`, `npm run test`, and `npm run build` before calling
  work done; CI runs the same plus a Compose smoke test.
- Frontend: prefer MUI components over hand-rolled UI; colors/spacing come
  from the MUI theme tokens, Tailwind is layout utilities only. MUI
  `CssBaseline` is the sole CSS reset (Tailwind preflight is off — see
  `frontend/src/app/globals.css`). Keep MUI focus states/ARIA intact.
- Tests: Vitest. Keep or add a focused test with every behavior change
  (adapter contract tests replay recorded Sleeper payloads — TDD Section 8).
- Env access on the backend goes through `backend/src/shared/config.ts`
  (fail-fast validation); do not read `process.env` ad hoc elsewhere.

## Scope discipline

- Milestones are defined in PRD Section 17 (M0 foundations → M4 polish).
  Build the milestone asked for; name later steps instead of doing them.
- User-visible capability changes need a PRD update; design changes need a
  TDD update (check its Open Technical Decisions, Section 7, first). Add a
  change-log row when you edit either doc.
