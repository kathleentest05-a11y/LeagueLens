# LeagueLens

View your fantasy rosters across sports + providers in one hub — with smart
alerts before a missed lineup costs you the week.

LeagueLens aggregates every team a fantasy manager owns (Sleeper leagues via
its public read-only API, offline leagues via CSV import) into one dashboard
with cross-league alerts for injured/bye-week starters and approaching
lineup locks. It is read-only: it never writes back to a provider.

> Status: M0 scaffold. The app skeleton runs end to end (Next.js web,
> GraphQL API, sync-worker process, Postgres); product features land in
> M1+ per the roadmap in [docs/PRD.md](docs/PRD.md).

## Docs

- [Product requirements (docs/PRD.md)](docs/PRD.md) — what LeagueLens does.
- [Technical design (docs/TDD.md)](docs/TDD.md) — how it is built.
- [AGENTS.md](AGENTS.md) — working rules for contributors and AI agents.

## Quickstart (Docker, full stack)

Prerequisites: Docker with the Compose plugin. Node (via `.nvmrc`) is only
needed for host inner-loop development.

```bash
cp .env.example .env
docker compose up --build
```

Then open <http://localhost:3000> in a browser. The GraphQL API is at
<http://localhost:4000/graphql> (health: <http://localhost:4000/healthz>).

## Inner-loop development (apps on host)

```bash
nvm install && nvm use        # Node pinned in .nvmrc
npm install
docker compose up db          # Postgres only (add --profile redis for Redis)
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local
npm run dev                   # web :3000, api :4000, worker
```

## Configuration

All config and secrets are environment variables (hard constraint, TDD
Section 9). Copy each `.env.example` to `.env.local` next to it and fill in
values; never commit real values.

| File | Holds |
| --- | --- |
| `.env.example` (root) | Compose-level Postgres settings + public GraphQL URL |
| `frontend/.env.example` | `NEXT_PUBLIC_*` browser config (non-secret; Firebase web config in M1) |
| `backend/.env.example` | Server-only config: `DATABASE_URL`, ports, upload dir, Sleeper rate-limit target, Firebase Admin (M1) |

Where values come from: local Postgres defaults are invented per-machine in
your root `.env`; Sleeper needs no API key; Firebase values come from a
Firebase project's console (or stay blank — M1 local dev uses the Auth
emulator). In a future deployment these are injected from the platform
secret store (e.g. Google Secret Manager) as environment variables; the
code reads `process.env` the same way everywhere (TDD Sections 9–10).

## Commands

```bash
npm run dev          # run web + api + worker on the host
npm run build        # codegen + build all workspaces
npm run typecheck    # TypeScript across workspaces
npm run lint         # ESLint across workspaces
npm run test         # Vitest across workspaces
npm run codegen      # regenerate GraphQL types into packages/shared
```

## Layout

- `frontend/` — React + Next.js (App Router, TypeScript) with MUI
  components and Tailwind layout utilities.
- `backend/` — Node + TypeScript; one package with the GraphQL API
  (`src/api/`) and sync worker (`src/worker/`) entrypoints, Prisma schema
  in `prisma/`.
- `packages/shared/` — TypeScript types/constants and generated GraphQL
  types shared by both apps.
- `docker-compose.yml` — web + api + worker + Postgres (+ optional Redis
  profile).

Architecture and delivery notes: [docs/TDD.md](docs/TDD.md) Sections 1, 10,
and 11.

## License

See [LICENSE](LICENSE). Note Sleeper's API is free for non-commercial use
only, so LeagueLens itself is a free, non-commercial build (PRD Section 6.3).
