// Stub API for issue #8 (pure frontend). Mirrors the GraphQL operations in
// TDD Section 2.1 — connectSleeper, dashboard, team, refreshLeague,
// disconnectProvider — with the typed error codes from Section 2.2.
// Replace these functions with Apollo useQuery/useMutation calls when the
// M1 backend lands; page components should not change shape.

import {
  alertsByTeam,
  leagues,
  matchupFor,
  myTeams,
  rosterFor,
  standingsFor,
  STUB_SYNC_TIMES,
} from './mock-data';
import {
  ApiStubError,
  type DashboardData,
  type ProviderConnection,
  type SyncState,
  type TeamCardData,
  type TeamDetailData,
} from './types';

/** Manual-refresh cooldown (TDD Section 4.3: 5 minutes). */
export const REFRESH_COOLDOWN_MS = 5 * 60_000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Per-league sync state; mutated by refreshLeague to demo cooldowns. */
const syncStates = new Map<string, SyncState>([
  [
    'lg-nfl-1',
    {
      lastSyncAt: STUB_SYNC_TIMES.fresh,
      providerUnavailable: false,
      inGameWindow: true,
      refreshAvailableAt: null,
    },
  ],
  [
    'lg-nfl-2',
    {
      lastSyncAt: STUB_SYNC_TIMES.stale,
      providerUnavailable: true,
      inGameWindow: true,
      refreshAvailableAt: null,
    },
  ],
  [
    'lg-nba-1',
    {
      lastSyncAt: STUB_SYNC_TIMES.fresh,
      providerUnavailable: false,
      inGameWindow: false,
      refreshAvailableAt: null,
    },
  ],
  [
    'lg-csv-1',
    {
      lastSyncAt: STUB_SYNC_TIMES.csvImported,
      providerUnavailable: false,
      inGameWindow: false,
      refreshAvailableAt: null,
    },
  ],
]);

export function syncStateFor(leagueId: string): SyncState {
  return (
    syncStates.get(leagueId) ?? {
      lastSyncAt: null,
      providerUnavailable: false,
      inGameWindow: false,
      refreshAvailableAt: null,
    }
  );
}

/**
 * Stub for `connectSleeper(username)` mutation.
 * Demo handles: "notfound" → SLEEPER_USER_NOT_FOUND,
 * "noleagues" → SLEEPER_NO_LEAGUES, anything else succeeds.
 */
export async function connectSleeper(
  username: string,
  onProgress?: (step: string) => void,
): Promise<ProviderConnection> {
  const handle = username.trim();
  onProgress?.('Looking up your Sleeper account…');
  await delay(700);

  if (!handle || handle.toLowerCase() === 'notfound') {
    throw new ApiStubError(
      'SLEEPER_USER_NOT_FOUND',
      `We couldn't find a Sleeper account for “${handle || username}”. Check the spelling and try again.`,
    );
  }
  if (handle.toLowerCase() === 'noleagues') {
    throw new ApiStubError(
      'SLEEPER_NO_LEAGUES',
      `The Sleeper account “${handle}” has no leagues for the current season. Connect a different account or import a league from CSV.`,
    );
  }

  onProgress?.('Found your account. Importing your leagues…');
  await delay(900);
  onProgress?.('Importing rosters and matchups…');
  await delay(700);

  return {
    id: 'conn-sleeper-1',
    provider: 'sleeper',
    handle,
    externalUserId: '1123581321345580544',
    status: 'connected',
    lastSyncAt: new Date().toISOString(),
  };
}

/** Stub for the CSV pseudo-connection shown in Settings. */
export const csvConnection: ProviderConnection = {
  id: 'conn-csv-1',
  provider: 'csv',
  handle: 'Imported leagues',
  externalUserId: 'csv',
  status: 'connected',
  lastSyncAt: STUB_SYNC_TIMES.csvImported,
};

/** Stub for `dashboard` query. Teams sorted needs-attention first (FR-3.2). */
export async function fetchDashboard(): Promise<DashboardData> {
  await delay(450);
  const cards: TeamCardData[] = myTeams.map((team) => {
    const league = leagues.find((l) => l.id === team.leagueId)!;
    return {
      team,
      league,
      matchup: matchupFor(team.leagueId),
      alerts: alertsByTeam[team.id] ?? [],
      syncState: { ...syncStateFor(team.leagueId) },
    };
  });

  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  cards.sort((a, b) => {
    const best = (c: TeamCardData) =>
      c.alerts.length === 0 ? 99 : Math.min(...c.alerts.map((al) => severityRank[al.severity]));
    return best(a) - best(b);
  });

  const openAlertCount = cards.reduce((n, c) => n + c.alerts.length, 0);
  const times = cards
    .map((c) => c.syncState.lastSyncAt)
    .filter((t): t is string => t !== null)
    .sort();
  return { teams: cards, openAlertCount, lastSyncedAt: times.at(-1) ?? null };
}

/** Stub for `team(id)` query; id here is the leagueId per the /teams/[leagueId] route. */
export async function fetchTeamDetail(leagueId: string): Promise<TeamDetailData> {
  await delay(450);
  const league = leagues.find((l) => l.id === leagueId);
  const team = myTeams.find((t) => t.leagueId === leagueId);
  if (!league || !team) {
    throw new ApiStubError('NOT_FOUND', 'That league could not be found.');
  }
  return {
    team,
    league,
    roster: rosterFor(team.id),
    matchup: matchupFor(leagueId),
    standings: standingsFor(leagueId),
    alerts: alertsByTeam[team.id] ?? [],
    syncState: { ...syncStateFor(leagueId) },
  };
}

export interface SyncResult {
  leagueId: string;
  lastSyncAt: string;
  refreshAvailableAt: number;
}

/** Stub for `refreshLeague(leagueId)` mutation with per-league cooldown (FR-2.3). */
export async function refreshLeague(leagueId: string): Promise<SyncResult> {
  const state = syncStateFor(leagueId);
  const now = Date.now();
  if (state.refreshAvailableAt && now < state.refreshAvailableAt) {
    const retryAfterSeconds = Math.ceil((state.refreshAvailableAt - now) / 1000);
    throw new ApiStubError(
      'REFRESH_COOLDOWN',
      `Refresh available again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
      retryAfterSeconds,
    );
  }
  await delay(800);
  const lastSyncAt = new Date().toISOString();
  const refreshAvailableAt = Date.now() + REFRESH_COOLDOWN_MS;
  syncStates.set(leagueId, {
    ...state,
    lastSyncAt,
    providerUnavailable: false,
    refreshAvailableAt,
  });
  return { leagueId, lastSyncAt, refreshAvailableAt };
}

/** Stub for `disconnectProvider(connectionId)` mutation (FR-1.4). */
export async function disconnectProvider(_connectionId: string): Promise<boolean> {
  void _connectionId;
  await delay(400);
  return true;
}
