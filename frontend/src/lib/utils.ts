import type { InjuryStatus, SportId, SyncState, Team } from './types';

export const SPORT_LABEL: Record<SportId, string> = { nfl: 'NFL', nba: 'NBA' };

export const PROVIDER_LABEL = { sleeper: 'Sleeper', csv: 'CSV import' } as const;

export function recordLabel(team: Team): string {
  if (team.ties > 0) return `${team.wins}–${team.losses}–${team.ties}`;
  return `${team.wins}–${team.losses}`;
}

export function formatScore(score: number | null): string {
  if (score === null) return '—';
  return score.toFixed(1);
}

/** Human relative time, e.g. "8 min ago", "2 h ago", "Yesterday". */
export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return 'Never synced';
  const diffMs = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export function absoluteTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** FR-2.4: stale means >1 hour old inside a game window. */
export function isStale(syncState: SyncState, now = Date.now()): boolean {
  if (!syncState.inGameWindow || !syncState.lastSyncAt) return false;
  return now - new Date(syncState.lastSyncAt).getTime() > 60 * 60_000;
}

export const INJURY_LABEL: Record<InjuryStatus, string> = {
  healthy: 'Healthy',
  questionable: 'Questionable',
  doubtful: 'Doubtful',
  out: 'Out',
  ir: 'Injured reserve',
};

export function cooldownLabel(refreshAvailableAt: number | null, now = Date.now()): string | null {
  if (!refreshAvailableAt || now >= refreshAvailableAt) return null;
  const secs = Math.ceil((refreshAvailableAt - now) / 1000);
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return mins > 0 ? `${mins}m ${rem}s` : `${rem}s`;
}
