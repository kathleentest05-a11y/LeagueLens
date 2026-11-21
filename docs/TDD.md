# LeagueLens — Technical Design Document

| Field | Value |
| --- | --- |
| Product | LeagueLens |
| Document status | Draft v0.8 |
| Last updated | 2026-11-21 |
| Owner | Kathleen |
| Companion doc | [docs/PRD.md](/home/kathleen/code/LeagueLens/docs/PRD.md) |
| Stack | React, Next.js, MUI (Material UI), Tailwind CSS, Node.js, GraphQL, PostgreSQL, Docker (cloud-ready; no cloud deployment in MVP) |

## How this doc relates to the PRD

The PRD defines *what* LeagueLens does and the product commitments it makes (scope, user stories, freshness and licensing constraints). This TDD defines *how* it is built. Anything a user can see or a stakeholder must approve belongs in the PRD. Schemas, limiter tuning, cache TTLs, and retry policy belong here.

In particular:

- GraphQL schema and API rules live in Section 2 of this doc. The PRD (Section 11) keeps only a capability summary.
- Sleeper rate-limit and caching mechanics live in Section 4.
- Frontend stack (React + MUI) lives in Section 1.1, the data model in Section 6.1, and system architecture in Section 1. The PRD keeps one-paragraph summaries (Sections 10 and 12).
- Configuration/secrets rules live in Section 9 and deployment (local Docker, future cloud) in Section 10. The PRD (Sections 6.3 and 14) keeps only the product rules: backend-only access, shared budget under 1,000 calls/minute, and throttled manual refresh.

## 1. Architecture overview

**MVP deployment decision (2026-11-20): no cloud deployment.** After a Google Cloud pricing review, hosted infrastructure is out of MVP scope. The MVP runs locally with Docker Compose at $0 hosting cost. The system is still designed cloud-native/cloud-ready (Section 10) so a future hosted deployment — Google Cloud Run + Cloud SQL is the reference target — needs packaging and provisioning only, not re-architecture. Kubernetes manifests and Terraform may describe that target in code during the MVP, but nothing is applied to a cloud account.

```text
Browser
  |
  v
Next.js app (React + MUI + Tailwind)   [container: web]
  |  GraphQL over HTTP(S), Firebase ID token
  v
Node.js GraphQL API                    [container: api]
  +-- PostgreSQL -- normalized leagues, teams, players, alerts   [container: db]
  +-- Redis -- rate-limiter state, cache, job queue (optional)   [container: redis]
  +-- Upload storage -- mounted volume in MVP; object storage when cloud-hosted (env-configured)

Background work
  Scheduler (worker-internal cron locally) --> sync worker (same Node codebase)   [container: worker]
                                          +-- Sleeper adapter -> normalize -> upsert
                                          +-- Alert engine -> evaluate PRD Section 9 rules
  Firebase Auth -- sign-up/sign-in (email + Google); emulator for local dev/tests
  Structured logs to stdout -- Docker locally, platform log collection when cloud-hosted
```

Service boundaries the implementation must respect:

- **Web (React + Next.js).** Renders UI and calls the GraphQL API with a Firebase ID token. It never calls Sleeper (or any provider) directly. See Section 1.1.
- **API (Node.js + GraphQL).** Serves reads from the normalized database only. It enqueues sync work; it does not perform provider REST calls inline, except for the bounded username lookup during connect (Section 3). One further exception is anticipated post-M1 — the Yahoo OAuth redirect/callback (code-for-token exchange) — and may only be built as designed in TD-8; it is not a general license for API-side provider calls.
- **Sync worker (Node.js, same codebase).** The only component allowed to call provider APIs for data. It owns the Sleeper rate limiter, caches, retries, normalization, upserts, and the alert engine run that follows each sync. The post-M1 Yahoo adapter follows the same shape: worker-only data calls through its own adapter/limiter, with per-user token refresh inside the worker (TD-8).
- **Stores.** PostgreSQL is the source of truth for normalized entities. Redis backs the shared rate limiter, request deduping, and hot caches when more than one worker instance runs (Section 4.4). Env-configured upload storage holds raw CSV files (mounted volume locally, object storage when cloud-hosted).

Data flow for a sync: scheduler/queue → sync worker → provider adapter → normalize → upsert (Section 6.1 identity rule) → alert evaluation → update `lastSyncAt`. The API and UI only ever read the result.

Architecture decisions:

- **One Node codebase, two runnable services** (API + sync worker) sharing the data layer and adapters; the worker scales independently during Sunday sync peaks. Locally they are separate Compose services; in a future cloud they map to separate Cloud Run services or Kubernetes Deployments unchanged.
- **PostgreSQL over a document store:** the domain is relational (leagues -> teams -> roster slots -> players) and standings/alerts need joins. Firestore remains an option only for future realtime features.
- **Sync is pull-based and idempotent:** scheduled jobs upsert on the Section 6.1 identity rule; a failed run simply retries — no partial-write cleanup needed.
- **CSV uploads never hit the API container's own disk:** files land in env-configured upload storage; the worker parses and validates from there.
- **No cloud-only APIs in application code.** Scheduler, queue, cache, and upload storage sit behind small interfaces (Sections 5 and 10) with local implementations first. Google-specific adapters (Cloud Scheduler/Pub/Sub, Cloud Storage, Secret Manager) are future drop-ins, which is what keeps the MVP portable.

### 1.1 Frontend: React, Next.js, and MUI

The frontend is **React** (via Next.js App Router, TypeScript). Next.js provides routing, server rendering for the landing page, and the build/deploy target; all interactive UI is React components.

**Component library: MUI (Material UI).** To avoid reinventing common UI, LeagueLens adopts MUI for standard controls and surfaces: buttons, text fields and forms, tables/data grids for rosters and standings, cards for dashboard teams, dialogs, alerts/snackbars, skeletons, tabs, and menus. Prefer an MUI component over a hand-rolled one; build custom components only for LeagueLens-specific composites (for example, TeamCard and the alert feed item) assembled from MUI primitives.

Rules for using it well:

- **Theme is the design system.** Colors, typography, spacing scale, dark mode, and alert-severity treatments live in one MUI theme. Components consume theme tokens (`sx` / styled) instead of hard-coded hex values, satisfying PRD Section 8.3 (mobile-first, dark-mode friendly, severity never by color alone — MUI icons + text labels carry the meaning).
- **MUI and Tailwind split.** MUI owns components and theming. Tailwind, if retained, is for page layout utilities only. Load order and Tailwind's preflight reset must be configured so the two resets do not fight (single `CssBaseline`-style reset wins; verify at M0 scaffolding). Do not style the same element with competing MUI `sx` and Tailwind utilities.
- **App Router integration.** Use MUI's Next.js App Router setup (Emotion cache provider) so server-rendered styles match the client and there is no flash of unstyled content.
- **Accessibility comes with the library — keep it.** Do not strip MUI focus states, labels, or ARIA wiring when customizing. Keyboard navigation and WCAG 2.1 AA contrast (PRD Sections 8.3 and 14) are acceptance criteria, not polish.
- **Bundle hygiene.** Import MUI components individually and let Next.js tree-shake; track the production bundle so the landing page keeps its LCP budget (PRD Section 14).

Swapping MUI for another React library later would be a frontend-only change, but treat MUI as decided for the MVP so M0 scaffolding and the design tokens milestone build on it directly.


## 2. GraphQL API design

A single GraphQL endpoint serves the Next.js front end. Queries are shaped around screens (dashboard, team detail) to avoid over- and under-fetching; DataLoaders batch player and team resolution to prevent N+1 queries against the database.

### 2.1 Core schema sketch

```graphql
type Query {
  me: User
  dashboard(filter: DashboardFilter): Dashboard!
  team(id: ID!): TeamDetail
  alerts(status: AlertStatus): [Alert!]!
  playerSearch(query: String!, sport: Sport): [PlayerOwnership!]!
}

type Mutation {
  connectSleeper(username: String!): ProviderConnection!
  disconnectProvider(connectionId: ID!): Boolean!
  previewCsvImport(file: Upload!): CsvImportPreview!
  confirmCsvImport(importId: ID!): League!
  refreshLeague(leagueId: ID!): SyncResult!
  acknowledgeAlert(alertId: ID!): Alert!
  updateAlertPreferences(input: AlertPreferencesInput!): User!
  deleteLeague(leagueId: ID!): Boolean!
}

type Dashboard {
  teams: [TeamCard!]!        # sorted: needs-attention first
  openAlertCount: Int!
  lastSyncedAt: DateTime
}

type TeamCard {
  team: Team!
  league: League!
  matchup: Matchup
  alerts: [Alert!]!
  syncState: SyncState!
}
```

This is a sketch, not the shipped schema. The schema in the backend codebase is authoritative once it exists; changes to user-visible capabilities still require a PRD update (PRD Section 11 summary).

### 2.2 API rules

- **Auth on every field.** The GraphQL layer verifies the Firebase ID token and scopes every resolver to the requesting user; no resolver may return another user's leagues, teams, or alerts. Unauthenticated access is limited to the seeded demo's read-only queries.
- **Errors are typed.** Domain failures (unknown Sleeper username, invalid CSV row, provider down, refresh on cooldown) return structured `errors.extensions.code` values the UI maps to specific messages. Initial codes: `SLEEPER_USER_NOT_FOUND`, `SLEEPER_NO_LEAGUES`, `CSV_VALIDATION_FAILED`, `PROVIDER_UNAVAILABLE`, `REFRESH_COOLDOWN`, `UNAUTHENTICATED`, `NOT_FOUND`.
- **Pagination** (cursor-based) on alerts and player search; dashboard is bounded by the user's own leagues and needs no pagination in the MVP.
- **No provider passthrough.** Resolvers read normalized database entities only; provider REST calls happen exclusively in sync jobs (Section 5), with one bounded exception: `connectSleeper` may resolve username to `user_id` synchronously, then enqueue the league fan-out (Section 3). Post-M1, the Yahoo OAuth callback (TD-8) is the only other sanctioned API-side provider exchange, and stored Yahoo tokens must never be exposed through any GraphQL field.
- **Rate limiting at the API edge.** Mutations that trigger provider work (`connectSleeper`, `refreshLeague`) are limited per user and per league (Section 4.3) so clients cannot amplify a UI action into Sleeper budget exhaustion. Exceeded limits return `REFRESH_COOLDOWN` with a retry-after hint the UI renders as "refresh available again in N minutes."
- **Uploads.** `previewCsvImport` never writes to the API instance's local disk: the file lands in env-configured upload storage (Section 1) and the worker parses it from there. When cloud-hosted this becomes a short-lived signed URL to object storage; locally it is a direct upload to the API-adjacent volume via the API service.


## 3. Sleeper integration

Source: [Sleeper API docs](https://docs.sleeper.com/#introduction). Base URL: `https://api.sleeper.app/v1`. Read-only, no auth token. All calls go through the provider adapter (PRD Section 6.2) and the Section 4 limiter. No other code may construct a Sleeper URL.

### 3.1 Identity: username is a handle, `user_id` is the key

`GET /user/{username}` and `GET /user/{user_id}` both return the user object (`username`, `user_id`, `display_name`, `avatar`). Sleeper usernames can change over time, so:

- On connect, resolve the entered username once and persist `externalUserId = user_id` plus `handle = username` at connect time on `ProviderConnection` (Section 6.1).
- Every subsequent call uses `user_id`, never the stored username.
- If the username lookup returns a literal `null` body, treat it as `SLEEPER_USER_NOT_FOUND` (FR-2.2). An account with zero leagues for the current season is `SLEEPER_NO_LEAGUES`, not a generic failure.

### 3.2 Endpoint inventory (MVP)

| Purpose | Endpoint | Cache owner |
| --- | --- | --- |
| Resolve user | `GET /user/{username or user_id}` | Connect flow only |
| List leagues | `GET /user/{user_id}/leagues/{sport}/{season}` | Sync worker, per sport/season |
| League detail | `GET /league/{league_id}` | Sync worker |
| Rosters | `GET /league/{league_id}/rosters` | Sync worker |
| League members | `GET /league/{league_id}/users` | Sync worker |
| Matchups | `GET /league/{league_id}/matchups/{week}` | Sync worker |
| Player directory | `GET /players/{sport}` | Sync worker, once per sport (Section 4.2) |
| Sport state | `GET /state/{sport}` | Sync worker |

The user's own team in each league is the roster whose `owner_id` equals the stored `user_id`. Unknown IDs can return `null`; adapters must null-check every response before normalizing.

### 3.3 Licensing constraint (engineering implications)

Sleeper documents the API as free for non-commercial purposes, with commercial use requiring a license (PRD Sections 3.2, 5.3, 6.3). Engineering must therefore not add billing gates, paywalls, or ad injection in front of Sleeper-derived data without a product/legal decision recorded in the PRD first. This is a constraint, not a feature flag.

## 4. Rate limiting and caching

### 4.1 The budget

Sleeper guidance: stay under 1,000 API calls per minute or risk an IP block. The budget is per source IP. All API and worker containers share the host's egress IP (locally, the developer/demo machine; when cloud-hosted, the platform egress), so the budget is shared across every LeagueLens user. Design targets:

- **Hard ceiling:** never exceed 1,000 calls/minute to `api.sleeper.app`.
- **Operating target:** 700 calls/minute sustained, leaving headroom for connect bursts and retries. Tune after observing real traffic; record changes here.
- **Rule zero:** the browser never calls Sleeper. All calls originate from the sync worker (plus the single connect-time lookup), through one client wrapper that enforces the limiter.

Rough capacity check: one league sync costs about 4 calls (league, rosters, users, matchups). At 700/minute, a 15-minute game-window cycle sustains roughly 2,600 league syncs, far above portfolio-demo scale. The player directory is one call per sport per refresh, not per league or per user (Section 4.2).

### 4.2 Caching layers

PostgreSQL (normalized entities) is the primary cache: the UI reads it exclusively. Redis and in-process caches are optimizations on top, never the source of truth.

| Data | Fetch cadence | Store | Notes |
| --- | --- | --- | --- |
| Player directory per sport | Daily (and on-demand if missing) | Postgres `Player` + raw payload retained short-term | Large payload (several MB). Fetch once server-side per sport. Never per user, per league, or per request. |
| Sport state (week/phase) | Hourly | Postgres/Redis | Drives current-week matchups and lock logic. |
| League settings/scoring | Daily, or when league first discovered | Postgres | Changes rarely after draft. |
| Rosters, members, matchups | Every 15 min in game windows, hourly otherwise | Postgres | Matches PRD Section 6.3 freshness commitment. |
| Dashboard reads | Per request from Postgres | Optional Redis hot cache, TTL under 60s | Must still surface true `lastSyncAt`; a hot cache may not make stale data look fresh (FR-2.4). |

Stale-while-revalidate: a failed or rate-limited sync leaves the last good data readable and badged stale (FR-2.5). Sync never deletes-then-recreates; it upserts on the Section 6.1 identity rule.

### 4.3 Limiter design

- **Central token bucket.** Every Sleeper call must acquire a token first. Capacity and refill implement the Section 4.1 target. Calls that cannot get a token wait in the sync queue; they do not fail the dashboard.
- **Shared across instances.** If the worker scales beyond one instance, tokens live in Redis (atomic consume). A single-instance worker may start with an in-process bucket, but scaling the worker without moving the bucket to Redis is a bug, not an optimization. Decision needed before scaling the worker (Section 7).
- **Deduping and coalescing.** Concurrent requests for the same resource (for example, two LeagueLens users in the same Sleeper league, or a scheduled sync overlapping a manual refresh) collapse into one in-flight fetch. Cache keys are provider resource IDs, not LeagueLens user IDs.
- **Per-league manual-refresh cooldown.** `refreshLeague` enqueues at most one sync per league per cooldown window (start: 5 minutes). Further calls return the existing sync state with `REFRESH_COOLDOWN`. `connectSleeper` is likewise limited per LeagueLens user to prevent username-guessing loops from burning budget.
- **Scheduling hygiene.** Stagger league syncs with jitter across the 15-minute window instead of firing them all on the minute. Player-directory refresh runs off-peak and outside game windows where possible.
- **Our own API limits.** In addition to the Sleeper-side bucket, apply per-user rate limits on `connectSleeper`, `refreshLeague`, and CSV preview/confirm at the GraphQL edge. These protect cost and abuse surface even when Sleeper budget remains.

### 4.4 Redis decision

Redis is optional for hot caching. For rate limiting it is conditionally required:

- One worker instance: in-process limiter acceptable for the earliest vertical slice.
- More than one worker instance (or worker + API both able to call Sleeper): Redis-backed limiter, dedupe locks, and cooldowns are required before scaling out.

Record the chosen topology here when M0/M1 lands. Do not scale the worker horizontally ahead of this decision.

### 4.5 Retries, backoff, and failure handling

- On HTTP 429 or 5xx from Sleeper: exponential backoff with jitter, bounded retries, and the token bucket still applies to retry attempts. Never retry-storm into an IP block.
- On repeated failure: mark the league's sync state stale, keep serving cached data, and emit the provider-unavailable notice (FR-2.5). Alert evaluation runs on last-good data; it does not invent fresh alerts from a failed sync.
- Timeouts are explicit per call. A hung Sleeper call must not pin a limiter token or a queue slot indefinitely.

### 4.6 Observability

Emit metrics per sync run: Sleeper calls made, calls/minute (rolling), limiter wait time, cache hit/miss for the player directory, deduped-call count, HTTP status histogram (especially 429s), and per-league `lastSyncAt` age. Alert internally before the budget is exhausted (for example, sustained usage above 80% of target) rather than learning about it from an IP block. Correlate logs with request/sync IDs (PRD Section 14).


## 5. Sync jobs

- **Triggers.** The worker's internal scheduler fires on the PRD Section 6.3 cadence (15 minutes in game windows, hourly otherwise; player directory daily). Manual refresh and connect publish the same job types with higher priority but identical limiter rules.
- **Job granularity.** One job per league bundle (`getLeagueBundle`) and one per sport for the player directory. Jobs are idempotent: re-running a job upserts the same identities and re-evaluates alerts without duplicating them (one open alert per team/type/player, PRD Section 9).
- **Ordering.** Player directory and sport state refresh before roster/matchup evaluation that depends on injury status and current week. A league job that runs against a stale player directory still completes; it records which directory version it used.
- **Partial failure.** If one league in a fan-out fails, the others still sync. Failures retry with backoff (Section 4.5) and surface in the internal sync-health view (PRD Section 14), not as dashboard errors.

## 6. Data model and storage

### 6.1 Data model (conceptual)

Provider payloads are normalized into these entities; provider-specific IDs are kept as external references, never as primary keys.

| Entity | Key fields | Notes |
| --- | --- | --- |
| `User` | id, firebaseUid?, email, displayName, authProvider | LeagueLens account (Firebase Auth identity). `firebaseUid` is the auth upsert key; the seeded demo user has none (`authProvider` = `demo`). |
| `ProviderConnection` | id, userId, provider (`sleeper` \| `csv`), externalUserId, handle, status, lastSyncAt | One row per connected provider or CSV source. M1 ships `sleeper` \| `csv` only; the M5 Yahoo migration adds `yahoo` plus its token storage as decided in TD-8 — do not widen the M1 schema preemptively. |
| `League` | id, connectionId, externalLeagueId?, name, sport, season, scoringSettings (JSON), source, currentWeek, totalTeams, lastSyncAt | `source` mirrors the provider for filtering and labeling. `lastSyncAt` is per-league because staleness is badged per league (FR-2.4); the connection keeps its own roll-up. |
| `Team` | id, leagueId, externalRosterId?, externalOwnerId?, ownerName, teamName, isMine, wins, losses, ties, pointsFor, pointsAgainst | Every roster in the league is stored (standings/matchups need opponents); the connection owner's team is flagged `isMine` (Sleeper roster whose `owner_id` matches, kept in externalOwnerId). |
| `Player` | id, sport, externalPlayerId?, fullName, position, proTeam, byeWeek, injuryStatus, statusSource | Directory entity shared across leagues; refreshed daily from Sleeper. |
| `RosterSlot` | id, teamId, playerId?, slotType (`starter` \| `bench` \| `ir`), slotPosition, slotIndex | Join of Team ↔ Player with lineup role. Null `playerId` is an empty required starter slot; `slotIndex` preserves roster-position order. |
| `Matchup` | id, leagueId, week, externalMatchupId?, homeTeamId, awayTeamId?, homeScore, awayScore, state | Scores nullable for CSV leagues and pre-game; `awayTeamId` null on a bye. Sleeper has no home/away — the adapter assigns sides deterministically from its pairing. |
| `Alert` | id, userId, teamId, type, severity, playerId?, slotPosition?, message, status, createdAt, acknowledgedAt, resolvedAt | See PRD Section 9 for lifecycle. `userId` denormalizes the team owner for the alert-feed path. |
| `CsvImport` | id, userId, leagueId?, fileName, status (`preview` \| `confirmed` \| `failed`), rowCount, errorCount, validationErrors (JSON), importedAt? | Audit trail for imports and the preview → confirm handle; powers idempotent re-import. |

**Identity rule:** two teams are the same team if and only if they share `(connectionId, externalLeagueId, externalRosterId)` — for CSV, `(userId, leagueName, sport, season, teamName)`. Syncs upsert on this identity; they never delete-then-recreate, so alert history survives refreshes. Physically (Section 6.2), the Sleeper tuple is composed of `League(connectionId, externalLeagueId)` + `Team(leagueId, externalRosterId)` unique constraints, and the CSV tuple of partial unique indexes, so no identity columns are denormalized onto Team.

### 6.2 Storage implementation notes

- Provider IDs (`externalLeagueId`, `externalRosterId`, `externalPlayerId`, `externalMatchupId`, Sleeper `user_id`) are stored as strings. Sleeper IDs exceed JavaScript's safe integer range; never parse them as numbers.
- Migrations own the physical schema (Prisma; decided 2026-11-20, TD-4). Index the dashboard path: teams by user/connection, roster slots by team, alerts by user/status, players by sport and external ID.
- Physical schema as landed (issue #3, 2026-11-21): cuid primary keys; snake_case tables/columns via Prisma `@@map`/`@map`; closed value sets are Postgres enums whose values match the `packages/shared`/frontend wire strings (`nfl`, `injured_starter`, …). Parent deletes cascade (connection → leagues → teams/slots/matchups, user → connections/alerts/imports) so disconnect and account deletion remove cached data (FR-1.4, FR-7.2); `Player` relations are `SetNull` so the shared directory and alert history survive. CSV identity compares names as stored — importers must trim before writing (M3).
- **Partial unique indexes live only in migration SQL.** Postgres treats NULLs as distinct in unique indexes, so the CSV identity (`leagues_csv_identity_key`, `teams_csv_identity_key`) and the one-open-alert rule (`alerts_one_open_per_team_type_player_slot_key`, PRD Section 9) are partial/expression unique indexes appended to the initial migration; Prisma cannot express them in `schema.prisma`. A future `prisma migrate dev` will see them as drift and propose dropping them — remove those drops from the generated migration instead of accepting them.
- `prisma generate` runs as part of backend `build`/`typecheck`/`test`. On Prisma 7 (since 2026-11-21) the generated client is plain TypeScript in `backend/src/generated/prisma` (`prisma-client` generator, `moduleFormat = "cjs"` to match the backend; gitignored, never committed or hand-edited), and connection URLs live outside the schema: `backend/prisma.config.ts` feeds the Migrate/CLI datasource, while the runtime client takes the URL from validated config via the `@prisma/adapter-pg` driver adapter in `backend/src/shared/db.ts`. `prisma.config.ts` deliberately avoids `env()` from `prisma/config` (it throws at load when `DATABASE_URL` is unset, which would break `generate`/`validate` in CI) and mirrors `src/shared/env.ts` env-file precedence. Migrations are always an explicit step (Section 10.1): `npm run db:migrate -w @leaguelens/backend` in dev, `db:migrate:deploy` against a built image / in Compose via `docker compose run --rm api npm run db:migrate:deploy -w @leaguelens/backend`. The `prisma` CLI is therefore a backend runtime dependency, not a devDependency. Backend code gets the client from `backend/src/shared/db.ts` (lazy singleton).
- Raw provider payloads may be retained briefly for contract tests and debugging, with a lifecycle rule. They are never served to the client.

## 7. Open technical decisions

| # | Decision | Needed by |
| --- | --- | --- |
| TD-1 | Worker topology: single instance with in-process limiter vs. Redis-backed shared limiter from day one (Section 4.4). | Before scaling the worker |
| TD-2 | Operating limiter target (starting proposal: 700/minute) confirmed against observed Sleeper behavior in dev. | During M1 |
| TD-3 | **Decided (2026-11-20): SDL-first.** `backend/src/api/schema.graphql` is authoritative; GraphQL Code Generator writes frontend types into `packages/shared/src/generated/`. | M0 scaffolding |
| TD-4 | **Decided (2026-11-20): Prisma** for PostgreSQL access and migrations (see PRD OQ-4). | Before schema build (see PRD OQ-4) |
| TD-5 | **Done (2026-11-21):** `.env.example` ×3 committed (names only), typed startup config in `backend/src/shared/config.ts`, backend loads `backend/.env.local` then `backend/.env` via `dotenv` at both entrypoints (`backend/src/shared/env.ts`; real environment always wins, missing files are a no-op in Docker), and the `README.md` setup + env-table update (Section 9.5). | M0 scaffolding |
| TD-6 | Kubernetes manifests + Terraform in MVP as validated-but-unapplied artifacts, or Post-MVP (Section 10.3/10.4). Default: Compose ships first; K8s/Terraform never block M1. | M0/M4 planning |
| TD-7 | Revisit Nx/Turborepo only if workspace script build/test times hurt (Section 11.1). Default: stay on plain npm workspaces. | Post-MVP or on measured pain |
| TD-8 | Yahoo OAuth + token lifecycle design (M5, post-M1; PRD Section 6.4). Gated on the M5 spike verifying: Fantasy Sports read permission actually granted on the registered app; a local-dev redirect round-trip given Yahoo requires `https` redirect URIs and rejects plain-`http` localhost (`https://localhost` registration on the LeagueLens app is already confirmed accepted, 2026-11-21 — the browser delivers the redirect, so a locally trusted-TLS listener (e.g. mkcert) on the registered port/path should suffice; a tunnel-fronted public `https` URL fronting only the callback listener is the fallback only if the TLS round-trip fails); signed-in-user league discovery across games/seasons, roster/matchup/player-status field mapping onto PRD Section 9, and Yahoo rate limits. Design must then decide: callback route shape (API HTTP route vs. GraphQL) with OAuth `state`/CSRF handling and read-only scope; refresh-token storage with encryption at rest (incl. any key env var) and rotation; worker refresh-before-sync and the user-visible re-auth-needed state on revoked/failed refresh; revoke + purge on disconnect (FR-1.4) and account delete (FR-7.2); Yahoo adapter limiter budget; and how local dev (Compose and host) serves the `https` callback the spike proved, without adding TLS burden to the default demo path. Yahoo *config* plumbing already landed 2026-11-21 (optional, all-or-nothing `YAHOO_*` in `backend/src/shared/config.ts`, redirect URI validated as `https`); no Yahoo network code until this decision closes. | Before any Yahoo build (M5) |

## 8. Testing notes

- Identity-rule integration test (`backend/src/shared/db.integration.test.ts`, issue #3): gated on `TEST_DATABASE_URL` pointing at a dedicated `*test*` database (refused otherwise), it applies migrations itself and proves Sleeper league/team/player upserts update one row, the CSV partial uniques reject duplicates without constraining Sleeper rows, one open alert per (team, type, player/slot), and disconnect cascades. CI runs it against a Postgres service container; locally it is skipped unless the variable is set.
- Contract tests replay recorded Sleeper payloads (including `null`-body responses) through the adapter without network access. The M5 Yahoo adapter gets the same treatment, plus token-refresh/revoked-consent tests with a fake Yahoo token endpoint — tests never need a real client secret.
- Limiter tests prove the client wrapper cannot exceed its budget under concurrent load and that deduping collapses identical in-flight calls.
- Sync idempotency tests run the same league bundle twice and assert one set of entities and no duplicate open alerts.

## 9. Configuration and secrets (hard constraint)

**Hard constraint: credentials and secrets exist only as environment variables. They are never committed to the Git repository, never hard-coded in source, and never pasted into docs, issues, or chat.** This applies to database passwords/URLs, Firebase Admin credentials, any future provider tokens, signing keys, and third-party API keys. Ordinary configuration (URLs, feature flags, limiter targets) follows the same env-var path so there is one mechanism, not two.

### 9.1 How secrets flow

- **Local development.** Each developer keeps real values in an untracked `.env` / `.env.local` file (per app: `frontend/`, `backend/`). The repo's `.gitignore` already ignores `.env` and `.env.*`. A committed `.env.example` lists every variable *name* with placeholder values and a one-line description — names only, never real secrets. Copying `.env.example` to `.env.local` and filling in values is the entire local setup.
- **Deployed environments (future).** Real values live in the platform secret store (Google Secret Manager for the reference cloud target, Kubernetes Secrets/external-secrets on K8s) and are injected as environment variables (or mounted secret volumes read at startup). Application code reads `process.env` the same way locally and in production; it never embeds store credentials and never falls back to a default secret.
- **CI/CD.** GitHub Actions builds and tests without production secrets (test doubles/emulator only). Any future deploy job receives credentials via GitHub secrets / Workload Identity Federation. CI logs must never echo env values, and Docker build args must never carry server secrets (anything baked into an image is effectively published).

### 9.2 Public vs. secret variables (Next.js)

Next.js exposes only `NEXT_PUBLIC_*` variables to the browser. Treat that prefix as "published":

- `NEXT_PUBLIC_*` may hold non-secret client config only (for example, the Firebase *web* config and the GraphQL endpoint URL). These still come from env vars for per-environment correctness, but assume anyone can read them.
- Everything else — `DATABASE_URL`, Firebase Admin private key, Redis credentials, session/signing secrets — is server-only, has no `NEXT_PUBLIC_` prefix, and must never be imported into client components. A server secret reaching the browser bundle is a release-blocking bug.

### 9.3 Expected variables (names only)

Final names are fixed at M0 scaffolding; `.env.example` becomes authoritative then. Anticipated set:

| Variable | Side | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Server | PostgreSQL connection (Compose `db` service locally) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Server | Firebase Admin token verification |
| `NEXT_PUBLIC_FIREBASE_*` | Browser | Firebase web client config (non-secret) |
| `NEXT_PUBLIC_GRAPHQL_URL` | Browser | GraphQL endpoint |
| `REDIS_URL` | Server | Redis, if enabled (Section 4.4) |
| `UPLOAD_DIR` (local) / `UPLOAD_BUCKET` (future cloud) | Server | CSV upload storage location |
| `SLEEPER_RATE_LIMIT_PER_MIN` | Server | Limiter operating target (Section 4.1) |
| `YAHOO_CLIENT_ID`, `YAHOO_CLIENT_SECRET`, `YAHOO_REDIRECT_URI` | Server | Registered Yahoo OAuth app (M5, post-M1). Optional and all-or-nothing: all blank = Yahoo disabled on this install; a partial set fails startup. Redirect URI must be an `https` URL exactly matching the registered app (Yahoo rejects `http` redirects; local pattern per TD-8 spike). Never `NEXT_PUBLIC_`. |

Note Sleeper itself needs no credential — there is no `SLEEPER_API_KEY`, and inventing one in config would be wrong. Yahoo is the opposite shape: per-install app credentials (above) plus, at runtime, per-user OAuth refresh tokens. Those tokens are secrets stored in the database by necessity; they are encrypted at rest per TD-8, never logged, and never returned by the API.

### 9.4 Safety rules

- **Fail fast.** Each service validates required env vars at startup (single typed config module) and exits with a clear "missing X" error instead of running half-configured.
- **Never log secrets.** Config logging prints variable names and non-secret values only. Redact connection strings in error reports.
- **Rotate on suspicion.** If a secret is ever committed or exposed, treat it as compromised: rotate/revoke it immediately and report the remaining exposure. Deleting the file from HEAD does not un-leak a committed secret.
- **Review surface.** Pull requests that add a variable must update `.env.example` in the same change. Code review rejects hard-coded credential-looking strings.

### 9.5 README follow-up (landed with M0 env hookup, TD-5)

Done with M0 (TD-5, completed 2026-11-21): `README.md` documents (1) the `docker compose up` quickstart, (2) copying each `.env.example` (root to `.env`; `frontend/` and `backend/` to `.env.local`) and where to obtain each value (Firebase console/emulator, local Postgres defaults for Compose, registered Yahoo app for the optional `YAHOO_*` set), and (3) how a future deployment manages values in its platform secret store. The backend actually loads `backend/.env.local` then `backend/.env` via `dotenv` at both entrypoints (`backend/src/shared/env.ts`); variables already set in the real environment win, and missing files are a no-op so Docker images are unaffected.

## 10. Deployment: local-first, cloud-ready

### 10.1 MVP: Docker Compose (the only required environment)

- One `Dockerfile` per runnable service (`web`, `api`, `worker`), multi-stage builds, pinned Node LTS, non-root user, `.dockerignore` excluding `.env*`, `node_modules`, and VCS data. Images contain code only — no secrets, no local data (Section 9).
- Root `docker-compose.yml` wires `web + api + worker + db (Postgres) + redis (optional profile)` with named volumes for Postgres data and CSV uploads, healthchecks (`pg_isready`, API `/healthz`), and `depends_on: condition: service_healthy` so first boot is deterministic.
- One-command demo: `docker compose up --build`, then seed (`docker compose run --rm api npm run db:seed` or an entrypoint-gated migrate+seed in dev profile). Migrations run as an explicit step/job, never implicitly competing across replicas.
- Firebase Auth uses the local emulator in dev/test profiles so the demo works without a cloud project; a real Firebase project remains free-tier SaaS when wanted. No other external account is needed to run the MVP (Sleeper needs no key).
- CI (GitHub Actions): lint/typecheck/test, `docker compose build`, and a smoke boot of the stack. No cloud credentials in CI for the MVP.

### 10.2 Cloud-ready / cloud-native checklist

These properties are MVP requirements precisely so hosting later is boring:

- **Twelve-factor config:** all config and secrets via env vars (Section 9); no host paths, no committed config files with credentials.
- **Stateless processes:** `web`/`api`/`worker` keep no local state; sessions, cache, limiter tokens, and uploads live in Postgres/Redis/upload storage. Any replica can die and reschedule.
- **Port binding + health endpoints:** each service binds `PORT` from env and exposes liveness/readiness (`/healthz`, `/readyz`) for Compose, Kubernetes, and Cloud Run alike. Graceful shutdown on SIGTERM (finish in-flight sync batch or checkpoint safely; sync is idempotent, Section 5).
- **Logs to stdout/stderr**, structured with correlation IDs (Section 4.6). No log files inside containers.
- **Backing services by URL:** `DATABASE_URL`, `REDIS_URL`, upload location — swapping Compose Postgres for Cloud SQL (or any managed Postgres) is an env change, not a code change. Same for Redis -> Memorystore and volume -> Cloud Storage/S3.
- **Horizontal scale path:** API scales freely; worker scaling requires the Redis-backed limiter decision first (Section 4.4, TD-1). That ordering is the cloud-readiness test.

### 10.3 Future: Kubernetes (optional, local-first)

- `deploy/k8s/` (plain manifests or Kustomize; Helm only if templating pain appears): Deployments for `web`/`api`/`worker`, Services, Ingress, ConfigMap for non-secret config, Secret (or External Secrets) for credentials, Postgres as an external/managed service preferred over a StatefulSet, HPA on `api` only, resource requests/limits and probes wired to Section 10.2 health endpoints.
- Validated locally on kind/minikube (`kubectl apply --dry-run`, plus a kind smoke run) — no cloud cluster, no spend, in MVP. Manifests must deploy the *same images* Compose runs; no K8s-only build.
- Scope call (TD-6): ship manifests in MVP as a portfolio artifact, or defer to Post-MVP. Default if time is short: Compose is the deliverable, K8s manifests are stretch. Do not let K8s block M1.

### 10.4 Future: Terraform (reference Google Cloud target)

- `infra/terraform/` describes the reference hosted architecture corresponding 1:1 to the Compose services: Cloud Run (`web`, `api`, `worker`), Cloud SQL for PostgreSQL, Memorystore for Redis, Cloud Storage bucket for uploads, Secret Manager secrets injected as env vars, Cloud Scheduler + Pub/Sub replacing the worker-internal cron, Artifact Registry for images, and least-privilege service accounts. State backend and variables (`terraform.tfvars.example`, no secrets) included.
- MVP bar is `terraform fmt` + `terraform validate` (+ `plan` against a throwaway/free-tier project only if Kathleen explicitly approves). **`terraform apply` is out of MVP scope** — provisioning (and therefore billing) starts only with a Post-MVP budget decision (PRD Sections 5.2 and 12).
- Portability note: because services are plain containers with env config (Section 10.2), the same images also fit non-Google targets (any Kubernetes, Fly.io/Render-style PaaS, a single VM running Compose). Terraform/Google is the documented reference, not a lock-in the code depends on.

## 11. Repository structure: workspaces + Docker (combo)

**Decision: lightweight JS workspaces for code, Docker Compose for runtime. No Nx, no Lerna in the MVP.** These are orthogonal tools, not alternatives:

- **Workspaces** answer "how do frontend and backend share TypeScript types and install dependencies once?" Docker cannot do this.
- **Docker Compose** answers "how do the apps plus PostgreSQL and Redis run together with one command?" Workspaces cannot do this — `db` and `redis` are not JS packages.

Containerize-only would force duplicated GraphQL types (or copy-paste codegen output that drifts) and a rebuild-the-image dev loop. Workspaces-only would leave every developer hand-installing Postgres/Redis. So: both.

### 11.1 Why not Nx or Lerna

- **Lerna:** built to version and publish packages to npm. LeagueLens publishes nothing; its packages are two deployable apps plus private shared code. Lerna adds nothing here (modern Lerna is itself powered by Nx). Skip.
- **Nx:** genuinely useful at scale (task graph, affected builds, remote cache, generators), but it is a framework-grade commitment — config, plugins, daemon, opinions — for what is today three packages. It can be layered onto plain workspaces later without restructuring if build times ever hurt. Defer; do not pay the learning/config tax in M0. (Turborepo is the lighter middle option if task caching is ever needed; also deferred.)
- **Plain workspaces (chosen):** built into the package manager. One lockfile, one install, `workspace:*` links for shared code, root scripts to run everything. Zero extra tooling to learn or debug inside Docker.

**Package manager: npm workspaces** (Node's built-in; no extra install, best-trodden path with Next.js and Docker layer caching). Yarn Classic workspaces are equivalent if preferred; avoid Yarn Berry/PnP, which complicates Next.js and container builds for no MVP benefit. Swapping npm <-> pnpm later is a lockfile change, not a restructure.

### 11.2 Layout

```text
LeagueLens/
  package.json            # private root: workspaces + root scripts only, no app deps
  package-lock.json       # single lockfile for the whole repo
  docker-compose.yml      # web + api + worker + db + redis (Section 10.1)
  frontend/               # @leaguelens/frontend — React + Next.js + MUI (Section 1.1)
    Dockerfile
  backend/                # @leaguelens/backend — ONE package, two entrypoints:
    Dockerfile            #   api (GraphQL) and worker (sync) = same image, different CMD
    src/api/  src/worker/  src/shared/ (data layer, adapters, alert engine)
  packages/
    shared/               # @leaguelens/shared — TS types/enums shared by both apps
                          #   (Sport, AlertType, GraphQL codegen output types)
  docs/  deploy/k8s/  infra/terraform/
```

Rules:

- **Backend stays one package.** API and worker share the data layer, Sleeper adapter, and alert engine (Section 1). Splitting them into two workspace packages would invent a shared-backend package anyway. Two entrypoints, one Docker image, two Compose services with different commands — independent scaling without package surgery.
- **Shared means shared types, not shared runtime.** `packages/shared` holds TypeScript types, constants, and generated GraphQL client types. No DB access, no secrets, no server-only code may leak into it via the frontend bundle (Section 9.2). The GraphQL schema in `backend` is the source; codegen generates frontend types into `shared` (run in CI; drift fails the build).
- **Root scripts are the task runner** until proven insufficient: `npm run dev` (all apps), `npm run build|test|lint --workspaces`, `npm run codegen`. Add Nx/Turborepo only on measured build pain (TD-7).
- **Docker builds are workspace-aware.** Dockerfiles copy the root lockfile + every `package.json` first, install with the workspace filter for that app, then copy source — so dependency layers cache and images stay per-app. Build context is the repo root; `frontend/Dockerfile` never reaches into `backend` at runtime, only into `packages/shared` at build time.

### 11.3 Two dev modes, one codebase

- **Full-stack/demo mode:** `docker compose up` runs everything (Section 10.1). This is the portfolio demo and the CI smoke test.
- **Inner-loop mode:** `docker compose up db redis` for backing services only, apps on the host via workspace scripts for hot reload (`npm run dev -w @leaguelens/frontend`). Same env vars (Section 9), `localhost` instead of Compose service names. Fast iteration without giving up real Postgres/Redis.

Both modes must keep working; a change that only works in one is incomplete.

---

### Change log

| Version | Date | Change |
| --- | --- | --- |
| 0.1 | 2026-11-20 | Initial draft. GraphQL schema and API rules moved here from PRD Section 11; Sleeper rate-limit (under 1,000 calls/minute per IP) and caching design added. PRD keeps product-level summaries only. |
| 0.2 | 2026-11-20 | Added frontend design (React + MUI, Section 1.1); data model moved here from PRD Section 10 (Section 6.1); system architecture moved here from PRD Section 12 (Section 1); config/secrets hard constraint (Section 9, README follow-up TD-5); deployment rescoped to local Docker Compose MVP with cloud-ready checklist and future Kubernetes/Terraform (Section 10, TD-6). |
| 0.3 | 2026-11-20 | Repo structure decided (Section 11): npm workspaces (`frontend`, single `backend` with api+worker entrypoints, `packages/shared`) plus Docker Compose for runtime incl. Postgres/Redis. Nx/Lerna explicitly deferred (TD-7). |
| 0.4 | 2026-11-20 | M0 tooling decided: SDL-first GraphQL with codegen into `packages/shared` (TD-3), Prisma (TD-4), Apollo Client, Vitest, ESLint + Prettier, Tailwind retained (utilities only; MUI CssBaseline is the single reset, Section 1.1). Node pinned via `.nvmrc`. |
| 0.5 | 2026-11-21 | Yahoo planned post-M1 ahead of ESPN (PRD v0.5): optional all-or-nothing `YAHOO_*` config landed in `backend/src/shared/config.ts` + `backend/.env.example` with Compose pass-through to api/worker (Section 9.3); anticipated Yahoo OAuth callback carved out of the no-provider-passthrough rules (Sections 1, 2.2) strictly as designed in new TD-8; `ProviderConnection` stays `sleeper` \| `csv` for M1 (Section 6.1). No Yahoo network code yet. |
| 0.6 | 2026-11-21 | M0 exit verification (issue #1) found the README's `backend/.env.local` step was a no-op — nothing loaded the file. Backend now loads `backend/.env.local` then `backend/.env` via `dotenv` at both entrypoints (`backend/src/shared/env.ts`, real environment wins, missing files no-op in Docker); TD-5 marked done and Section 9.5 updated from deferred to done; README configuration wording corrected (root example copies to `.env`, not `.env.local`). |
| 0.7 | 2026-11-21 | Prisma physical model landed (issue #3): all nine Section 6.1 entities in `backend/prisma/schema.prisma` + initial migration. Section 6.1 key fields updated to as-built (User.firebaseUid, League currentWeek/totalTeams/lastSyncAt, Team externalOwnerId/pointsAgainst, RosterSlot nullable player = empty slot + slotIndex, Matchup externalMatchupId/nullable away team, Alert slotPosition/acknowledgedAt, CsvImport preview status). Section 6.2 records the encoding: Sleeper identity composed of League+Team uniques, CSV identity and one-open-alert rule as partial unique indexes in migration SQL only, cuid PKs, snake_case maps, wire-matching enums, `prisma generate` wired into backend build/typecheck/test, `prisma` CLI as a runtime dependency for explicit `migrate deploy`, and the `TEST_DATABASE_URL`-gated identity integration test (Section 8). Header version aligned to this change log (was stale at v0.5). |
| 0.8 | 2026-11-21 | Prisma 6 → 7 upgrade: `datasource url` removed from `schema.prisma` (unsupported in Prisma 7 schema files); Migrate/CLI URL moved to new `backend/prisma.config.ts` (Section 6.2 records why it avoids `env()`); runtime client now constructed with the `@prisma/adapter-pg` driver adapter fed from `loadConfig()` in `backend/src/shared/db.ts` (5s connect timeout restored to match Prisma 6 behavior); generator switched to `prisma-client` with plain-TS output in gitignored `backend/src/generated/prisma` (`moduleFormat = "cjs"`); backend image now ships `prisma.config.ts` for in-container `migrate deploy`. No schema/model changes. |
