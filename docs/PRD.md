# LeagueLens — Product Requirements Document

| Field | Value |
| --- | --- |
| Product | LeagueLens |
| Document status | Draft v0.5 |
| Companion doc | [docs/TDD.md](/home/kathleen/code/LeagueLens/docs/TDD.md) (technical design: frontend, GraphQL schema, data model, system architecture, Sleeper rate limiting/caching, secrets, deployment) |
| Last updated | 2026-11-21 |
| Owner | Kathleen |
| Build type | Portfolio / demo build (full-stack showcase) |
| Stack | React, Next.js, MUI (Material UI), Tailwind CSS, Node.js, GraphQL, Docker (cloud-ready; no cloud deployment in MVP) |

## 1. Overview

LeagueLens is a unified hub for fantasy sports managers who play in multiple leagues across multiple sports. Today, managing several teams means bouncing between apps and tabs — one per provider, one per league — just to answer simple questions: *Are all my lineups set? Is anyone injured? How am I doing this week?*

LeagueLens pulls every team a manager owns into a single dashboard with cross-league alerts, so nothing slips through the cracks during a busy week.

**One-line pitch:** View your fantasy rosters across sports and providers in one hub — with smart alerts before a missed lineup costs you the week.

### 1.1 Vision

Become the first screen a multi-league manager opens each morning: one glance shows every team, every matchup, and every action that needs attention.

### 1.2 Product principles

1. **One hub, not another silo.** LeagueLens aggregates; it does not replace the providers where leagues are hosted.
2. **Provider access is optional.** A manager with no API-backed league (for example, an old-school offline league run by a commissioner) must still be able to use LeagueLens via CSV import.
3. **Alerts over dashboards.** The dashboard is the surface; the value is catching problems — injuries, bye-week starters, impending lineup locks — before they happen.
4. **Read-first, low-risk.** The MVP never writes back to a provider. There is zero chance LeagueLens sets a wrong lineup.

## 2. Problem statement

Multi-league, multi-sport managers face three recurring pains:

| Pain | What happens today | Cost |
| --- | --- | --- |
| Fragmentation | Each provider shows only its own leagues; each league view buries the manager's other teams. | 5–15 minutes of tab-hopping per check-in, multiplied across every sport in season. |
| Missed actions | Injuries, inactive designations, bye weeks, and lineup locks surface inside individual league pages. | Starting an inactive or bye-week player silently forfeits points and matchups. |
| Offline leagues are invisible | Commissioner-run, offline, or legacy leagues live in spreadsheets and group chats. | Those teams get no dashboard at all and are the easiest to forget. |

The pain peaks when seasons overlap (for example, NFL Sundays during the NBA regular season), which is exactly when managers have the least time per team.

## 3. Goals and non-goals

### 3.1 Goals (MVP)

- **G1.** Show all of a manager's teams across sports in one dashboard within 60 seconds of sign-up.
- **G2.** Surface cross-league problems proactively: lineup-lock warnings, injured/inactive starters, and bye-week starters.
- **G3.** Support managers without API access by importing offline leagues from CSV.
- **G4.** Demonstrate a production-shaped full-stack architecture: Next.js front end, Node + GraphQL API, and background sync jobs — runnable locally with Docker and designed cloud-ready (see TDD), without requiring a paid cloud deployment for the MVP.

### 3.2 Non-goals (MVP)

- Writing back to any provider (no setting lineups, add/drop, or trades on Sleeper).
- Hosting leagues, scoring games, or running drafts.
- Real-money features, wagering, or daily fantasy (DFS) lineup building.
- Monetization, billing, or tiered plans (this is a portfolio build; Sleeper's API terms also restrict use to non-commercial purposes without a commercial license — see Section 6.3).
- Native mobile apps (responsive web only).

## 4. Target users

### 4.1 Primary persona — "Maya, the multi-league manager"

- Plays in 3–6 leagues across 2+ sports (for example, two NFL leagues and one NBA league).
- Competitive but time-poor; manages teams in short bursts on her phone.
- Has lost at least one matchup to a forgotten lineup or a late injury designation.
- **Job to be done:** "Before games start, tell me if any of my teams needs my attention — and let me see everything at once."

### 4.2 Secondary persona — "Chris, the offline-league lifer"

- Plays in a long-running commissioner-run league managed in a spreadsheet, plus one Sleeper league.
- Cannot connect an API because his main league has none.
- **Job to be done:** "Track my spreadsheet league next to my Sleeper teams so I stop treating it as an afterthought."

### 4.3 Tertiary persona — "The commissioner"

- Runs an offline or Sleeper league and wants a clean standings/score view to share.
- Out of scope as a primary MVP user; needs are captured as future requirements (Section 5.3).

### 4.4 Key user stories

| ID | Story | Priority |
| --- | --- | --- |
| US-1 | As a manager, I connect my Sleeper account once and see every Sleeper league I own a team in, across sports. | Must |
| US-2 | As a manager, I see all my teams on one dashboard with this week's matchup and score at a glance. | Must |
| US-3 | As a manager, I am warned before a lineup lock if I am starting an injured, inactive, or bye-week player. | Must |
| US-4 | As an offline-league manager, I import my league from CSV and see it beside my API-backed teams. | Must |
| US-5 | As a manager, I drill into any team to see its full roster, starters vs. bench, and league standings. | Must |
| US-6 | As a manager, I filter the dashboard by sport, league, or "needs attention." | Should |
| US-7 | As a manager, I search for a player once and see which of my leagues roster him. | Should |
| US-8 | As a manager, I control which alerts I receive and how far ahead of lock they fire. | Should |

## 5. Scope

### 5.1 MVP (v1.0)

- LeagueLens account (sign up, sign in, sign out).
- Connect Sleeper by username; auto-discover all of the user's Sleeper leagues (Section 6).
- CSV import for offline leagues (Section 6.5), with a downloadable template.
- Unified dashboard: every team, current matchup, live-ish score, and record.
- Team detail: roster (starters/bench/IR), player injury status, standings.
- Smart alerts: lineup-lock countdown, injured/inactive starter, bye-week starter, empty starter slot.
- Background sync of Sleeper data with visible "last synced" timestamps.
- Runnable locally via Docker Compose with seeded demo mode; cloud deployment is out of MVP scope (cloud-ready design only — Section 12 summary, TDD Section 10).

### 5.2 Post-MVP (v1.x)

- Hosted cloud deployment with a public demo URL (requires budget approval; MVP is local-only but cloud-ready — Section 12).
- Yahoo provider via per-user OAuth (planned post-M1 milestone M5, spike first — see Section 6.4). ESPN remains deferred with no milestone (Section 6.4).
- Player news feed and trending adds/drops across the manager's leagues.
- Weekly digest email and push notifications.
- Start/sit comparison using projections; waiver-wire suggestions.
- Historical seasons and cross-season performance trends.

### 5.3 Future (v2+)

- Trade analyzer and AI-assisted lineup optimization (the "manager copilot" tier).
- Commissioner tools: shareable standings pages, CSV export of results.
- Social layer: league activity feed, smack-talk-safe sharing cards.
- Monetization only if the licensing picture changes: Sleeper's API is free for non-commercial use only (Section 6.3), so any freemium, paid tier, or ad-supported model that serves Sleeper data requires a commercial license from Sleeper first. Until then LeagueLens stays free.

## 6. Provider integration strategy

### 6.1 Working assumptions

These assumptions are decided for the MVP and revisited only if a provider proves them wrong:

1. **Provider API access is optional.** CSV import is a first-class path, not a fallback buried in settings. Every dashboard feature that can work from CSV data must work for CSV leagues.
2. **One connection surfaces all leagues.** When a user connects a provider, LeagueLens treats that single connection as granting visibility into *all* of the user's leagues on that provider, across every supported sport. The user connects once; LeagueLens fans out internally (for Sleeper: one league query per sport and season) and presents one unified list.
3. **Sleeper first, Yahoo second, ESPN last.** Sleeper's public read API needs no OAuth, so it ships in the MVP. Yahoo has an official OAuth API and (as of 2026-11-21) a registered LeagueLens developer app, so it is the next provider after the Sleeper slice is proven — still post-MVP, because per-user consent and token upkeep are real work (Section 6.4). ESPN has no official API or OAuth at all, so it remains designed for, but not built or scheduled.

### 6.2 Provider adapter design

Every provider — including CSV — implements the same internal adapter contract, so the rest of the system never sees provider-shaped data:

- `resolveUser(handle)` → provider user.
- `listLeagues(providerUser)` → normalized leagues across sports.
- `getLeagueBundle(leagueId)` → league settings, members, rosters, matchups, standings.
- `getPlayers(sport)` → normalized player directory (cached; refreshed on a schedule).

All providers normalize into the shared data model in the TDD (summarized in Section 10). Adding Yahoo or ESPN later means writing one new adapter — no schema or UI rewrite — plus, for Yahoo, the OAuth connect and token lifecycle in Section 6.4.

### 6.3 Sleeper (MVP provider)

- **API:** Public read-only REST, `https://api.sleeper.app/v1`, no authentication or API token. Source: [Sleeper API docs](https://docs.sleeper.com/#introduction).
- **Licensing (non-commercial only).** Sleeper documents the API as "free to use for non-commercial purposes," with commercial use requiring a separate licensing discussion with Sleeper. LeagueLens is therefore a free, non-commercial build. No paid tier, billing, or advertising may be introduced on top of Sleeper data without first securing that license (see Sections 3.2 and 5.3).
- **Rate limit.** Sleeper's guidance is to stay under 1,000 API calls per minute or risk an IP block. The limit applies per source IP, so every LeagueLens user's sync shares the backend's egress budget. As a product rule, the browser never calls Sleeper directly and shared data (notably the player directory) is fetched once on the server, never once per user. Limiter and cache mechanics live in the technical design doc ([docs/TDD.md](/home/kathleen/code/LeagueLens/docs/TDD.md)).
- **Connect flow:** User enters their Sleeper username → `GET /user/{username}` resolves the `user_id` → `GET /user/{user_id}/leagues/{sport}/{season}` enumerates leagues per supported sport and the current season → the user's own roster in each league is the one whose `owner_id` matches. Usernames can change over time, so LeagueLens stores the resolved `user_id` and treats the username as a lookup handle only.
- **Data used:** `/league/{league_id}` (settings, scoring), `/league/{league_id}/rosters`, `/league/{league_id}/users`, `/league/{league_id}/matchups/{week}`, `/players/{sport}` (player directory with injury status), `/state/{sport}` (current week/season phase).
- **Sync policy (product commitment):** Player directory daily; leagues/rosters/matchups every 15 minutes during active game windows, hourly otherwise. Data is cached server-side and the UI always reads LeagueLens' store, never Sleeper directly. Manual refresh is throttled per league so users cannot exhaust the shared rate budget.
- **Limits to design around:** League lists are per sport and season (handled by the fan-out in 6.1); unknown IDs can return a literal `null` body; data is read-only by design.

### 6.4 Yahoo (planned post-M1) and ESPN (deferred) — both out of MVP scope

Both providers are designed for (Section 6.2) but not built in the MVP. No MVP UI may promise either beyond a disabled "Coming soon" affordance. Provider order is Sleeper, then Yahoo, then ESPN (Section 6.1). Findings recorded 2026-11-20; Yahoo updated 2026-11-21:

**Yahoo Fantasy — planned as the M5 (post-M1) milestone, spike first.** The Yahoo Fantasy Sports API requires a registered developer application (consumer key/secret via the [Yahoo developer portal](https://developer.yahoo.com/apps/)) and per-user OAuth 2.0 consent. As of 2026-11-21 a LeagueLens Yahoo app is registered, which clears only the registration step. What it does *not* clear — and why Yahoo stays out of the MVP and behind the Sleeper slice:

- **Per-user OAuth consent (decided 2026-11-21: for any LeagueLens user, not owner-only).** Each user authorizes their own Yahoo account through an OAuth redirect flow; LeagueLens never sees a Yahoo password. That flow, its error/denied states, and a "reconnect Yahoo" state when consent is revoked are new product surface.
- **Token lifecycle.** Yahoo access tokens are short-lived (about one hour), so the sync worker must store a refresh token per user and refresh before syncing. Disconnect (FR-1.4) and account deletion (FR-7.2) must revoke/purge those tokens. Token storage design (encryption at rest, rotation) is TDD open decision TD-8.
- **Unconfigured installs stay clean.** The client secret belongs to the registered app, so a reviewer who clones the repo has no working Yahoo credentials. Yahoo config is therefore optional (`YAHOO_CLIENT_ID`/`YAHOO_CLIENT_SECRET`/`YAHOO_REDIRECT_URI`, backend-only): blank means the Yahoo affordance renders disabled and nothing else changes. Yahoo can never be a demo or MVP exit criterion.

Before any Yahoo build is scheduled, a time-boxed spike must verify: the registered app actually has Fantasy Sports read permission granted (not just created); an OAuth redirect round-trips in local development despite Yahoo requiring `https` redirect URIs (plain-`http` localhost is rejected, but the Yahoo portal accepted an `https://localhost` redirect URI on the registered app — confirmed 2026-11-21 — so the spike only needs to prove the round-trip against a locally trusted-TLS listener, since the browser delivers the redirect; a tunnel-fronted public `https` URL is the fallback only if that fails); league discovery for the signed-in user across games/seasons, and which roster/matchup/player-status fields map onto the Section 9 alert rules; and Yahoo's rate limits. The spike's output is the TD-8 decision in the TDD, not production code. Yahoo Must-level requirements are deliberately not added to Section 7 until the spike passes, so the MVP definition of done (Section 17.2) is unchanged.

**ESPN Fantasy — deferred indefinitely, no milestone; Yahoo goes first.** ESPN has no official public Fantasy API or OAuth flow. The available route is an undocumented internal API documented by the community (see the [Public ESPN Fantasy API docs](https://github.com/pseudo-r/Public-ESPN-Fantasy-API), including its [authentication notes](https://github.com/pseudo-r/Public-ESPN-Fantasy-API/blob/main/docs/authentication.md)). Two blockers keep it out of the MVP:

1. **No user-based discovery.** The API is league-scoped, not user-scoped. There is no equivalent of Sleeper's username → `user_id` → all leagues lookup, so LeagueLens cannot auto-discover "every ESPN league this user is in." Enumerating public league IDs is not a sustainable or permissible substitute. Even for public leagues (which need no auth), the user would have to supply each `leagueId`, season, and sport by hand. That breaks the Section 6.1 promise that one connection surfaces all leagues.
2. **Private leagues need browser session cookies.** Private leagues require the user's `espn_s2` session token and `SWID` cookie, copied out of the browser's dev tools. There is no OAuth alternative. Asking users to extract cookies is poor onboarding, those cookies are account-equivalent secrets LeagueLens would have to store and refresh, and they rotate on password change or session expiry. Coupled with an undocumented API that can change without notice, that is too fragile a foundation for the MVP.

A future ESPN spike, if pursued, should start with public leagues via user-supplied league IDs and must resolve discovery and token storage before any "connect ESPN" promise reaches the UI.

### 6.5 CSV import (offline leagues)

- A downloadable template defines the format; the importer validates headers, roster sizes, and duplicate players before saving anything.
- Minimum viable CSV: league name, sport, team name, player name, position, starter/bench flag. Optional: opponent/score columns for the current matchup, wins/losses for standings.
- Import is **idempotent**: re-uploading the same file updates the same league instead of duplicating it. Errors are reported row-by-row with a fix-and-retry path.
- CSV leagues support dashboard, roster, and manual-status alerts (for example, a manually flagged injured starter). Live scores and automatic injury sync are unavailable and must be labeled as such in the UI.
- Full field spec lives in Appendix A.

## 7. Functional requirements

Priority key: **Must** = required for MVP launch · **Should** = MVP if time allows, first in v1.x otherwise · **Could** = stretch.

### 7.1 Accounts and onboarding

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1.1 | Users can create a LeagueLens account, sign in, and sign out (email/password plus Google sign-in via Firebase Auth). | Must |
| FR-1.2 | First-run onboarding offers two equal paths: "Connect Sleeper" and "Import a league from CSV." Either path alone yields a usable dashboard. | Must |
| FR-1.3 | A visitor can explore a read-only demo with seeded leagues without creating an account ("View demo"). | Must |
| FR-1.4 | Users can disconnect a provider or delete an imported league; both actions remove the associated cached data. | Must |

### 7.2 Provider connection and sync

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-2.1 | Connecting Sleeper requires only a username; LeagueLens discovers all leagues for the current season across supported sports and imports the user's own team in each. | Must |
| FR-2.2 | Invalid usernames and zero-league accounts produce specific, recoverable error states (not a generic failure). | Must |
| FR-2.3 | A background job re-syncs provider data on the Section 6.3 schedule; users can also trigger a manual refresh per league, subject to a per-league cooldown that protects the shared provider rate budget (the UI shows when a refresh is available again). | Must |
| FR-2.4 | Every league surface shows its "last synced" time; stale data (>1 hour in a game window) is visibly badged, never silently presented as fresh. | Must |
| FR-2.5 | Provider outages degrade gracefully: cached data remains readable and the UI shows a "provider unavailable" notice. | Must |

### 7.3 Unified dashboard

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-3.1 | The dashboard lists every team the user owns — Sleeper and CSV together — each showing league name, sport, team name, record, current matchup, and score where available. | Must |
| FR-3.2 | Teams with active alerts are visually flagged and sortable to the top ("needs attention" first). | Must |
| FR-3.3 | Users can filter by sport, provider, and alert status, and search by league or team name. | Should |
| FR-3.4 | A cross-league player search shows every roster (across the user's leagues) that owns a given player. | Should |
| FR-3.5 | Empty states guide the next action: no leagues → connect/import CTAs; no alerts → an explicit "all clear" state. | Must |

### 7.4 League and team detail

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-4.1 | Team detail shows the full roster grouped as starters, bench, and IR/reserve, with position, pro team, bye week, and injury status per player. | Must |
| FR-4.2 | Team detail shows league standings and the current week's matchup (opponent, both scores, win/loss state). | Must |
| FR-4.3 | CSV leagues render the same layout with "manually imported — not live" labeling and an "update via re-import" action. | Must |
| FR-4.4 | Past weeks' matchups are viewable via a week picker where provider data supports it. | Could |

### 7.5 CSV import

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-5.1 | Users can download a CSV template and upload a league file; a preview step shows parsed teams/players before anything is saved. | Must |
| FR-5.2 | Validation reports row-level errors (missing fields, unknown positions, duplicate players on one team) and blocks save until fixed or rows are removed. | Must |
| FR-5.3 | Re-importing a file for the same league name and sport updates that league rather than creating a duplicate. | Must |
| FR-5.4 | Users can manually set a player's status (healthy/questionable/out) in a CSV league so starter alerts still work. | Should |

### 7.6 Alerts

Detailed rules are specified in Section 9.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-6.1 | The system generates alerts for: injured/inactive starter, bye-week starter, empty starter slot, and lineup lock within a configurable window while any of the previous conditions hold. | Must |
| FR-6.2 | Alerts appear in-app on the dashboard and team pages, with deep links to the exact roster slot in question. | Must |
| FR-6.3 | Users can mute alert types per league and set the lock-warning window (default: 2 hours). | Should |
| FR-6.4 | Email delivery for lock-window alerts (in-app remains the source of truth). | Could (v1.x) |

### 7.7 Settings

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-7.1 | Settings list connected providers and imported leagues with disconnect/delete actions. | Must |
| FR-7.2 | Users can delete their account, which deletes their provider links, imported leagues, and alert history. | Must |

## 8. Experience design

### 8.1 Information architecture

```text
LeagueLens
├── Landing (pitch, live demo entry, sign in)
├── Dashboard (all teams; default post-login route)
│   └── Team detail — /teams/[leagueId]
│       ├── Roster (starters / bench / IR)
│       ├── Matchup (current week)
│       └── Standings
├── Alerts (cross-league alert feed; also summarized on Dashboard)
├── Import (CSV template download, upload, preview, validation)
└── Settings
    ├── Connections (Sleeper link, disconnect; ESPN/Yahoo "coming soon")
    ├── Imported leagues (re-import, delete)
    └── Account (profile, delete account)
```

### 8.2 Key flows

1. **Connect Sleeper:** Sign up → onboarding → enter Sleeper username → progress state while leagues import → dashboard populated. Target: under 60 seconds end to end.
2. **Import CSV:** Download template (optional) → upload file → preview parsed league → fix flagged rows inline or re-upload → confirm → league appears on dashboard.
3. **Sunday check-in:** Open dashboard → "needs attention" teams float to the top → tap alert → land on the exact roster slot → switch to Sleeper to make the fix (LeagueLens is read-only, and the UI says so at the point of action).

### 8.3 Design requirements

- Mobile-first responsive layouts; the dashboard must be fully usable at 375px width.
- Dark-mode-friendly MUI theme (Tailwind for layout); sport and alert severity are never encoded by color alone (always paired with a label or icon).
- Loading skeletons for sync-backed views; optimistic UI only for local actions (filters, mutes), never for provider data.
- Accessibility: semantic landmarks, keyboard-navigable tables/cards, visible focus states, WCAG 2.1 AA contrast.

## 9. Alerts specification

Alerts are computed server-side after every sync and stored as first-class records (created, acknowledged, resolved). A resolved condition (for example, the user benches the injured player and the next sync sees it) auto-resolves the alert.

| Alert type | Trigger | Clears when | Severity |
| --- | --- | --- | --- |
| Injured/inactive starter | A starter's status is Out, IR, Doubtful, or Inactive in the player directory (or manually set Out in a CSV league). | Player leaves the starting lineup or status improves. | High |
| Bye-week starter | A starter's pro team is on bye in the current scoring week. | Player is benched or the week rolls over. | High |
| Empty starter slot | A required starter slot has no player assigned. | Slot is filled. | High |
| Lineup lock approaching | First relevant game locks within the user's warning window (default 2h) **and** any high-severity alert is open for that team. | Lock passes or underlying alerts resolve. | Critical |
| Questionable starter | A starter is Questionable within 24h of their game. | Status clears or game starts. | Medium |
| Sync stale | Provider data for a league is older than the staleness threshold during a game window. | Next successful sync. | Low |

Rules:

- **No alert spam.** One open alert per (team, type, player/slot); updates mutate the existing record.
- **Questionable ≠ Out.** Only Out-grade statuses trigger high severity; Questionable stays medium to protect trust in the system.
- **CSV parity.** CSV leagues evaluate the same rules against imported/manual statuses, minus live lock timing (lock alerts use the sport's typical weekly lock only if the CSV provides a game time; otherwise they are suppressed and replaced with a static "check your lineup" reminder state).
- Every alert renders *why* it fired, *which slot*, and *what to do* ("Bench Player X — open Sleeper to fix"), with a deep link to the team page.

## 10. Data (summary)

LeagueLens stores a normalized, provider-independent view of each user's leagues, teams, players, matchups, and alerts, plus an audit trail for CSV imports. Provider accounts link to LeagueLens accounts without ever storing a provider password, and re-syncing or re-importing updates the same records instead of duplicating them, so alert history survives refreshes. The full entity model, identity/upsert rules, and storage design live in the technical design doc ([docs/TDD.md](/home/kathleen/code/LeagueLens/docs/TDD.md)).

## 11. API capabilities (summary)

The front end talks to a single authenticated API. The full design — endpoint choice, schema, authorization, error model, and pagination — lives in the technical design doc ([docs/TDD.md](/home/kathleen/code/LeagueLens/docs/TDD.md)). This PRD keeps only the product-level capabilities the API must provide:

- Read the signed-in user's dashboard (all teams, matchups, alerts, sync state), team detail, alert feed, and cross-league player search.
- Connect and disconnect Sleeper by username; preview and confirm CSV imports; request a throttled manual refresh; acknowledge alerts; update alert preferences; delete leagues and accounts.
- Every capability is scoped to the requesting user, failures surface as specific user-facing messages (unknown username, invalid CSV row, provider unavailable, refresh on cooldown), and no API response ever proxies a live provider call — responses come from LeagueLens' cached, normalized data (Sections 6.3 and 7.2).

## 12. Delivery (summary)

The MVP is delivered as a local, containerized stack with a seeded demo mode — no cloud account or hosted URL is required to evaluate it. LeagueLens is designed cloud-ready (stateless containerized services, environment-variable configuration, externalized database/cache/upload storage) so it can be hosted later without re-architecture, but **cloud deployment itself is Post-MVP work requiring an explicit budget decision**. System architecture, container topology, and the future Kubernetes/Terraform target are specified in the TDD (Sections 1 and 10) in [docs/TDD.md](/home/kathleen/code/LeagueLens/docs/TDD.md).

## 13. Technology stack

| Layer | Choice | Why |
| --- | --- | --- |
| Front end | React + Next.js (App Router, TypeScript) | SSR/SSG for landing + fast first paint; file-based routing maps cleanly to Section 8. |
| Styling / components | MUI (Material UI) + Tailwind CSS | MUI supplies ready-made, accessible React components and theming so the team does not hand-roll tables, forms, and dialogs; Tailwind covers layout utilities. Frontend design: TDD Section 1.1. |
| Data fetching | Apollo Client against the GraphQL API | Cache-first dashboard, typed hooks via codegen. |
| Back end | Node.js + TypeScript, Apollo Server (GraphQL) | One language across the stack; DataLoader for N+1 protection. |
| Database | PostgreSQL (Docker locally; managed Postgres if cloud-hosted later), Prisma ORM | Relational fit, migrations, type-safe queries. |
| Auth | Firebase Authentication | Google sign-in with near-zero auth code; JWTs verified server-side. |
| Jobs | Sync worker with internal scheduler (+ Redis queue if enabled) | Same worker locally and in a future cloud; managed cron/queues (e.g. Cloud Scheduler + Pub/Sub) are a drop-in later. |
| Hosting (MVP) | Docker + Docker Compose (local) | Zero hosting cost; one-command demo. Cloud-ready: containers, env config, stateless services (TDD Section 10). |
| CI/CD | GitHub Actions → build, test, build container images | Proves the stack builds clean; cloud deploy step added only when hosting is funded (Post-MVP). |
| Future cloud | Kubernetes manifests + Terraform (Google Cloud target) | Describes the hosted architecture in code (`terraform validate`/`plan` only in MVP; no `apply`, no spend). |
| Testing | Vitest + Testing Library; Playwright for critical flows | Connect flow, CSV import, and alert generation get end-to-end coverage. |

## 14. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Performance | Dashboard GraphQL query p95 < 500 ms server-side for a user with 10 leagues; landing page LCP < 2.5 s on mid-tier mobile. |
| Freshness | During game windows, displayed scores/rosters no more than 15 minutes behind Sleeper; staleness always visible (FR-2.4). |
| Reliability | A Sleeper outage or rate-limit never 500s the dashboard; cached reads + exponential-backoff retries in sync jobs. All Sleeper traffic originates from the backend under a shared budget of under 1,000 calls/minute per egress IP (player directory cached once per sport server-side). Limiter and cache design: [docs/TDD.md](/home/kathleen/code/LeagueLens/docs/TDD.md). |
| Security | HTTPS everywhere; Firebase tokens verified on every request; user-scoped authorization in resolvers; credentials supplied only as environment variables, never committed to the repo (hard constraint, TDD Section 9); CSV uploads scanned for type/size (max 2 MB, `.csv` only) and stored privately. |
| Privacy | LeagueLens stores the minimum needed: account identity, provider handles, and normalized fantasy data. No provider passwords are ever collected. Yahoo (post-M1, Section 6.4) stores per-user OAuth refresh tokens only — never Yahoo passwords — and disconnect/account deletion revokes and purges them (FR-1.4, FR-7.2). Account deletion removes user data (FR-7.2). |
| Accessibility | WCAG 2.1 AA; full keyboard navigation; severity and sport never conveyed by color alone. |
| Observability | Structured logs with request/sync correlation IDs to stdout; a sync-health view (internal) showing last run per provider. Hosted error reporting plugs in when cloud-hosted. |
| Cost | MVP hosting cost $0: everything runs locally in Docker. Lifecycle rule deletes raw CSV uploads after 30 days. Any future cloud deployment needs an explicit budget decision first. |

## 15. Success metrics

This is a portfolio build, so "success" is measured on demo-ability and craft first, product metrics second.

### 15.1 Portfolio / demo success

- A reviewer can clone the repo, start the stack with Docker Compose, enter the seeded demo, and understand the product in under 2 minutes without a walkthrough (screenshots/video in the README tell the story without a hosted URL).
- The repo README explains how to run each tier locally and links the architecture in the TDD.
- Core flows (connect, CSV import, alert generation) are covered by automated tests visible in CI.

### 15.2 Product metrics (instrument from day one)

| Metric | Definition | MVP target |
| --- | --- | --- |
| Time to first dashboard | Sign-up start → first populated dashboard view | < 60 s (p50) |
| Leagues per user | Connected + imported leagues per active user | ≥ 2 (validates the multi-league thesis) |
| Alert action rate | % of high-severity alerts resolved before lock | Directional; baseline in MVP |
| Weekly retention | % of users active in week N returning in week N+1 during a season | Directional; baseline in MVP |
| Sync success rate | % of scheduled sync runs completing without error | > 99% |

## 16. Risks, assumptions, and open questions

### 16.1 Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Sleeper API changes or tightens rate limits | Sync breaks; dashboard goes stale | Adapter isolation (Section 6.2), server-side caching, contract tests against recorded payloads. |
| Sleeper IP block from exceeding 1,000 calls/minute | All users' sync stops (budget is per egress IP, shared) | Backend-only Sleeper access, shared rate limiter with headroom, request deduping, throttled manual refresh (Section 6.3; design in [docs/TDD.md](/home/kathleen/code/LeagueLens/docs/TDD.md)). |
| Monetization pressure conflicts with Sleeper's non-commercial terms | Legal/licensing exposure if LeagueLens charges while serving Sleeper data | No paid tier, billing, or ads without a Sleeper commercial license (Sections 3.2, 5.3, 6.3). |
| Sleeper-league-only MVP underserves ESPN/Yahoo managers | Smaller addressable demo audience | CSV path gives those managers a working route on day one; Yahoo is the planned next provider (M5, post-M1) and ESPN stays designed-in only (Section 6.4). |
| Yahoo OAuth/refresh-token upkeep leaks MVP focus or credentials (post-M1) | Delayed Sleeper slice; stored-token exposure | Yahoo is sequenced after M1 behind a spike + TDD TD-8 (encryption at rest, revoke/purge on disconnect/delete); config is optional so unconfigured installs store no tokens at all (Section 6.4). |
| Injury-status data lags reality | Missed or wrong alerts erode trust | Conservative severity rules (Section 9), "last synced" transparency, manual CSV status overrides. |
| Username-only Sleeper connect lets anyone view public leagues by guessing a handle | Privacy perception issues | Data is already public via Sleeper's API; LeagueLens accounts still gate who can attach a connection, and disconnect is one click. Document clearly in-app. |

### 16.2 Assumptions (to validate during build)

1. Sleeper's player directory injury statuses are timely enough for pre-lock alerts.
2. Current-season-only league discovery satisfies MVP users; historical seasons can wait for v1.x.
3. Offline-league managers will tolerate a structured CSV template (versus pasting freeform rosters).
4. Read-only value (view + alerts) is compelling without in-app lineup editing.

### 16.3 Open questions

| # | Question | Owner | Needed by |
| --- | --- | --- | --- |
| OQ-1 | Which sports ship in MVP beyond NFL — NBA in v1.0 or v1.1? (Sleeper league discovery fans out per sport, so this is a config + testing call.) | Kathleen | Before sync-worker build |
| OQ-2 | Does the demo use a real public Sleeper account's leagues or fully seeded fixtures? Seeded is deterministic; real data proves the integration. Proposal: seeded demo + live-connect with your own username. | Kathleen | Before demo seed work |
| OQ-3 | Email alerts in v1.0, or in-app only (FR-6.4 currently Could)? | Kathleen | Before alerts build |
| OQ-4 | **Closed (2026-11-20): PostgreSQL + Prisma confirmed.** (Was: Postgres vs. Firestore; TDD Sections 1 and 6 recommended Postgres.) | Kathleen | Before schema build |

## 17. Roadmap and definition of done

### 17.1 Milestones

| Milestone | Scope | Exit criteria |
| --- | --- | --- |
| **M0 — Foundations** | Monorepo/app scaffolding (`frontend/`, `backend/`), Docker Compose stack, CI, MUI theme/design tokens, `.env.example` | Empty Next.js + GraphQL "hello" runs via `docker compose up` and CI builds images. |
| **M1 — Sleeper vertical slice** | Auth, connect-by-username, sync one sport, dashboard + team detail (read-only) | A real Sleeper user sees their actual teams in the locally running app (FR-1.x, FR-2.x, FR-3.1, FR-4.x). |
| **M2 — Alerts** | Alert engine (Section 9), dashboard flagging, preferences | Seeded injured-starter scenario produces a correct, resolving alert end to end (FR-6.x). |
| **M3 — CSV leagues** | Template, upload/preview/validate, idempotent re-import, manual statuses | Offline league round-trips from template to dashboard (FR-5.x, FR-4.3). |
| **M4 — Portfolio polish** | Seeded demo mode, landing page, README/architecture docs, Playwright pass | Public demo URL is shareable with no caveats (Section 15.1). |
| **M5 — Yahoo provider (post-M1, not MVP)** | Spike first (Section 6.4), then per-user OAuth connect, token lifecycle (TDD TD-8), Yahoo adapter + sync, connect/reconnect/disabled UI states. May start once M1 exits; does not block M2–M4 or the Section 17.2 MVP definition of done. Numbered M5 to avoid renumbering M2–M4. | With Yahoo config present, a LeagueLens user connects their own Yahoo account and sees their Yahoo teams beside Sleeper/CSV teams; with config absent, Yahoo renders disabled and the rest of the app is unaffected. ESPN is not in this milestone. |

### 17.2 Definition of done (MVP)

- Every **Must** requirement in Section 7 is implemented or explicitly cut with a note in this document's change log.
- Sleeper connect, CSV import, and alert lifecycle are covered by automated tests; CI is green on `main`.
- The full stack starts locally with Docker Compose and the demo mode works without an account. (No cloud deployment in MVP.)
- No screen presents stale or CSV data as live data.

## Appendix A — CSV import format (v1)

One row per rostered player. Header row required; column order fixed in the template.

| Column | Required | Values / notes |
| --- | --- | --- |
| `league_name` | Yes | Same value on every row; part of the re-import identity key. |
| `sport` | Yes | `nfl` \| `nba` (extend as sports are enabled). |
| `season` | Yes | Four-digit year, e.g. `2026`. |
| `team_name` | Yes | Fantasy team name; rows group into teams by this value. |
| `owner_name` | No | Display name of the team's manager. |
| `player_name` | Yes | Full name; matched fuzzily against the player directory for bye/injury enrichment where possible. |
| `position` | Yes | Sport-specific codes (e.g. NFL: `QB`, `RB`, `WR`, `TE`, `K`, `DST`). |
| `pro_team` | No | Pro team abbreviation; enables bye-week alerts. |
| `is_starter` | Yes | `true` \| `false`. Exactly the league's starter count per team should be `true`. |
| `player_status` | No | `healthy` \| `questionable` \| `out` (default `healthy`); drives FR-5.4 alerts. |
| `wins`, `losses`, `points_for` | No | Per-team standings snapshot; same value on all of a team's rows. |

## Appendix B — Glossary

- **Provider:** A platform hosting fantasy leagues (Sleeper, ESPN, Yahoo) or the `csv` pseudo-provider for offline leagues.
- **Adapter:** Server-side module translating one provider's data into the normalized model in the TDD.
- **Lineup lock:** The moment a player's game starts and their roster slot can no longer be changed.
- **Sync:** A scheduled pull of provider data into LeagueLens' normalized store.
- **Demo mode:** Account-free, read-only exploration using seeded leagues.

## Appendix C — Competitive landscape (summary)

Provider apps (Sleeper, ESPN, Yahoo) each show only their own leagues and alert only within their own walls. Advice tools (start/sit and trade analyzers) optimize decisions but don't unify team management. LeagueLens' wedge is the gap between them: **one cross-provider, cross-sport home screen whose alerts span every team a manager owns — including leagues with no API at all.**

---

### Change log

| Version | Date | Change |
| --- | --- | --- |
| 0.1 | 2026-11-20 | Initial draft. Scope decisions: Sleeper-first with CSV as a first-class offline path; dashboard + smart alerts as core value; portfolio/demo build. |
| 0.2 | 2026-11-20 | Provider and licensing findings: ESPN/Yahoo blockers detailed in Section 6.4 (both out of MVP); Sleeper non-commercial terms and 1,000 calls/minute rate limit recorded in Sections 3.2, 5.3, 6.3, 14, 16. GraphQL schema and rate-limit/cache design moved to [docs/TDD.md](/home/kathleen/code/LeagueLens/docs/TDD.md); Section 11 slimmed to a capability summary. |
| 0.3 | 2026-11-20 | Frontend adopts MUI component library (React + Next.js). Credentials-as-env-vars hard constraint recorded (design in TDD Section 9). Data model (Section 10) and system architecture (Section 12) slimmed to summaries and moved to the TDD. Cloud deployment descoped from MVP after Google Cloud pricing review: MVP is local Docker Compose, cloud-ready/cloud-native by design with Kubernetes/Terraform as unapplied future artifacts (TDD Section 10). |
| 0.4 | 2026-11-20 | OQ-4 closed: PostgreSQL + Prisma confirmed. Either/or stack choices resolved: Apollo Client, Vitest (Section 13). |
| 0.5 | 2026-11-21 | Yahoo promoted ahead of ESPN: a registered Yahoo OAuth app now exists, clearing only the registration step in Section 6.4. Yahoo is planned as post-M1 milestone M5 (spike first, per-user OAuth for any LeagueLens user, optional config so unconfigured installs stay clean); ESPN remains deferred with no milestone. MVP Must scope and Section 17.2 definition of done unchanged. Yahoo env names added to `backend/.env.example` (optional, all-or-nothing). |





