// Domain types mirroring TDD Section 2.1 (GraphQL sketch) and Section 6.1
// (data model). These are the shapes the M1 API will return; the stub API
// in ./stub-api.ts serves them until the backend lands. Provider IDs are
// strings (Sleeper IDs exceed JS safe integers).

export type SportId = 'nfl' | 'nba';
export type ProviderId = 'sleeper' | 'csv';
export type SlotType = 'starter' | 'bench' | 'ir';
export type InjuryStatus = 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir';
export type MatchupState = 'pre' | 'live' | 'final';
export type AlertSeverityId = 'low' | 'medium' | 'high' | 'critical';
export type AlertTypeId =
  | 'injured_starter'
  | 'bye_week_starter'
  | 'empty_starter_slot'
  | 'lineup_lock_approaching'
  | 'questionable_starter'
  | 'sync_stale';

export interface ProviderConnection {
  id: string;
  provider: ProviderId;
  handle: string;
  externalUserId: string;
  status: 'connected' | 'syncing' | 'error';
  lastSyncAt: string | null;
}

export interface League {
  id: string;
  connectionId: string;
  externalLeagueId: string | null;
  name: string;
  sport: SportId;
  season: string;
  source: ProviderId;
  currentWeek: number;
  totalTeams: number;
}

export interface Team {
  id: string;
  leagueId: string;
  teamName: string;
  ownerName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  isMine: boolean;
}

export interface Player {
  id: string;
  fullName: string;
  position: string;
  proTeam: string;
  byeWeek: number | null;
  injuryStatus: InjuryStatus;
}

export interface RosterSlot {
  id: string;
  teamId: string;
  player: Player;
  slotType: SlotType;
  slotPosition: string;
}

export interface MatchupSide {
  team: Team;
  score: number | null;
}

export interface Matchup {
  id: string;
  leagueId: string;
  week: number;
  home: MatchupSide;
  away: MatchupSide;
  state: MatchupState;
}

export interface AlertItem {
  id: string;
  teamId: string;
  type: AlertTypeId;
  severity: AlertSeverityId;
  message: string;
  playerName: string | null;
}

export interface SyncState {
  /** ISO timestamp of last successful sync; null if never synced. */
  lastSyncAt: string | null;
  /** True when the provider failed recently; cached data stays readable (FR-2.5). */
  providerUnavailable: boolean;
  /** True during an active game window; drives the >1h stale threshold (FR-2.4). */
  inGameWindow: boolean;
  /** Unix ms when manual refresh is allowed again (FR-2.3 cooldown). */
  refreshAvailableAt: number | null;
}

export interface TeamCardData {
  team: Team;
  league: League;
  matchup: Matchup | null;
  alerts: AlertItem[];
  syncState: SyncState;
}

export interface DashboardData {
  teams: TeamCardData[];
  openAlertCount: number;
  lastSyncedAt: string | null;
}

export interface StandingRow {
  rank: number;
  team: Team;
}

export interface TeamDetailData {
  team: Team;
  league: League;
  roster: RosterSlot[];
  matchup: Matchup | null;
  standings: StandingRow[];
  alerts: AlertItem[];
  syncState: SyncState;
}

/** Typed API error codes from TDD Section 2.2. */
export type ApiErrorCode =
  | 'SLEEPER_USER_NOT_FOUND'
  | 'SLEEPER_NO_LEAGUES'
  | 'PROVIDER_UNAVAILABLE'
  | 'REFRESH_COOLDOWN'
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND';

export class ApiStubError extends Error {
  readonly code: ApiErrorCode;
  readonly retryAfterSeconds?: number;

  constructor(code: ApiErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiStubError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
