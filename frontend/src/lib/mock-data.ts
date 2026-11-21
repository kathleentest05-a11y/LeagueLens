// Seeded stub data for the M1 frontend slice (issue #8). Stands in for the
// normalized database the real API will read (TDD Section 6.1). Covers the
// states the UI must handle: fresh, stale (>1h in game window), provider
// unavailable, injured/bye/questionable starters, and a CSV league.

import type { AlertItem, League, Matchup, Player, RosterSlot, StandingRow, Team } from './types';

const minsAgo = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

export const STUB_SYNC_TIMES = {
  fresh: minsAgo(8),
  stale: minsAgo(135),
  csvImported: minsAgo(60 * 26),
};

export const leagues: League[] = [
  {
    id: 'lg-nfl-1',
    connectionId: 'conn-sleeper-1',
    externalLeagueId: '1180425791830556672',
    name: 'Sunday Funday',
    sport: 'nfl',
    season: '2026',
    source: 'sleeper',
    currentWeek: 11,
    totalTeams: 12,
  },
  {
    id: 'lg-nfl-2',
    connectionId: 'conn-sleeper-1',
    externalLeagueId: '1180425791830556673',
    name: 'Dynasty Degenerates',
    sport: 'nfl',
    season: '2026',
    source: 'sleeper',
    currentWeek: 11,
    totalTeams: 10,
  },
  {
    id: 'lg-nba-1',
    connectionId: 'conn-sleeper-1',
    externalLeagueId: '1180425791830556674',
    name: 'Hoops Hustle',
    sport: 'nba',
    season: '2026',
    source: 'sleeper',
    currentWeek: 5,
    totalTeams: 12,
  },
  {
    id: 'lg-csv-1',
    connectionId: 'conn-csv-1',
    externalLeagueId: null,
    name: 'Office Old-Timers',
    sport: 'nfl',
    season: '2026',
    source: 'csv',
    currentWeek: 11,
    totalTeams: 8,
  },
];

export const myTeams: Team[] = [
  {
    id: 'tm-nfl-1',
    leagueId: 'lg-nfl-1',
    teamName: 'Hurts So Good',
    ownerName: 'Maya',
    wins: 7,
    losses: 3,
    ties: 0,
    pointsFor: 1248.6,
    isMine: true,
  },
  {
    id: 'tm-nfl-2',
    leagueId: 'lg-nfl-2',
    teamName: 'Rebuild Mode',
    ownerName: 'Maya',
    wins: 4,
    losses: 6,
    ties: 0,
    pointsFor: 1087.2,
    isMine: true,
  },
  {
    id: 'tm-nba-1',
    leagueId: 'lg-nba-1',
    teamName: 'Full Court Press',
    ownerName: 'Maya',
    wins: 3,
    losses: 1,
    ties: 0,
    pointsFor: 0,
    isMine: true,
  },
  {
    id: 'tm-csv-1',
    leagueId: 'lg-csv-1',
    teamName: 'Spreadsheet Kings',
    ownerName: 'Maya',
    wins: 6,
    losses: 4,
    ties: 0,
    pointsFor: 1155.0,
    isMine: true,
  },
];

const opp = (id: string, leagueId: string, teamName: string, ownerName: string): Team => ({
  id,
  leagueId,
  teamName,
  ownerName,
  wins: 5,
  losses: 5,
  ties: 0,
  pointsFor: 1100,
  isMine: false,
});

export const opponents: Record<string, Team> = {
  'lg-nfl-1': opp('tm-opp-1', 'lg-nfl-1', 'Waiver Wire Wizards', 'Jordan'),
  'lg-nfl-2': opp('tm-opp-2', 'lg-nfl-2', 'Tank Commanders', 'Sam'),
  'lg-nba-1': opp('tm-opp-3', 'lg-nba-1', 'Triple Threat', 'Alex'),
  'lg-csv-1': opp('tm-opp-4', 'lg-csv-1', 'Fax Machine FC', 'Chris'),
};

export function matchupFor(leagueId: string): Matchup | null {
  const mine = myTeams.find((t) => t.leagueId === leagueId);
  const other = opponents[leagueId];
  const league = leagues.find((l) => l.id === leagueId);
  if (!mine || !other || !league) return null;
  if (league.source === 'csv') {
    return {
      id: `mu-${leagueId}`,
      leagueId,
      week: league.currentWeek,
      home: { team: mine, score: null },
      away: { team: other, score: null },
      state: 'pre',
    };
  }
  const scores: Record<string, [number, number, Matchup['state']]> = {
    'lg-nfl-1': [98.4, 87.1, 'live'],
    'lg-nfl-2': [64.2, 91.7, 'live'],
    'lg-nba-1': [512.5, 498.0, 'live'],
  };
  const [home, away, state] = scores[leagueId] ?? [0, 0, 'pre'];
  return {
    id: `mu-${leagueId}`,
    leagueId,
    week: league.currentWeek,
    home: { team: mine, score: home },
    away: { team: other, score: away },
    state,
  };
}

export const alertsByTeam: Record<string, AlertItem[]> = {
  'tm-nfl-1': [
    {
      id: 'al-1',
      teamId: 'tm-nfl-1',
      type: 'injured_starter',
      severity: 'high',
      message: 'Christian McCaffrey is Out but still in your starting lineup.',
      playerName: 'Christian McCaffrey',
    },
    {
      id: 'al-2',
      teamId: 'tm-nfl-1',
      type: 'lineup_lock_approaching',
      severity: 'critical',
      message: 'Lineups lock soon and an injured starter is still active.',
      playerName: null,
    },
  ],
  'tm-nfl-2': [
    {
      id: 'al-3',
      teamId: 'tm-nfl-2',
      type: 'bye_week_starter',
      severity: 'high',
      message: 'Ja’Marr Chase is on bye this week but still starting.',
      playerName: 'Ja’Marr Chase',
    },
  ],
  'tm-nba-1': [
    {
      id: 'al-4',
      teamId: 'tm-nba-1',
      type: 'questionable_starter',
      severity: 'medium',
      message: 'Jayson Tatum is Questionable for tonight’s game.',
      playerName: 'Jayson Tatum',
    },
  ],
  'tm-csv-1': [],
};

function player(
  id: string,
  fullName: string,
  position: string,
  proTeam: string,
  byeWeek: number | null,
  injuryStatus: Player['injuryStatus'],
): Player {
  return { id, fullName, position, proTeam, byeWeek, injuryStatus };
}

function slot(
  id: string,
  teamId: string,
  p: Player,
  slotType: RosterSlot['slotType'],
  slotPosition: string,
): RosterSlot {
  return { id, teamId, player: p, slotType, slotPosition };
}

export const rosters: Record<string, RosterSlot[]> = {
  'tm-nfl-1': [
    slot(
      'rs-1',
      'tm-nfl-1',
      player('pl-1', 'Jalen Hurts', 'QB', 'PHI', 5, 'healthy'),
      'starter',
      'QB',
    ),
    slot(
      'rs-2',
      'tm-nfl-1',
      player('pl-2', 'Christian McCaffrey', 'RB', 'SF', 9, 'out'),
      'starter',
      'RB',
    ),
    slot(
      'rs-3',
      'tm-nfl-1',
      player('pl-3', 'Saquon Barkley', 'RB', 'PHI', 5, 'healthy'),
      'starter',
      'RB',
    ),
    slot(
      'rs-4',
      'tm-nfl-1',
      player('pl-4', 'CeeDee Lamb', 'WR', 'DAL', 7, 'healthy'),
      'starter',
      'WR',
    ),
    slot(
      'rs-5',
      'tm-nfl-1',
      player('pl-5', 'A.J. Brown', 'WR', 'PHI', 5, 'questionable'),
      'starter',
      'WR',
    ),
    slot(
      'rs-6',
      'tm-nfl-1',
      player('pl-6', 'Travis Kelce', 'TE', 'KC', 6, 'healthy'),
      'starter',
      'TE',
    ),
    slot(
      'rs-7',
      'tm-nfl-1',
      player('pl-7', 'Brandon Aubrey', 'K', 'DAL', 7, 'healthy'),
      'starter',
      'K',
    ),
    slot(
      'rs-8',
      'tm-nfl-1',
      player('pl-8', 'James Conner', 'RB', 'ARI', 8, 'healthy'),
      'bench',
      'BN',
    ),
    slot(
      'rs-9',
      'tm-nfl-1',
      player('pl-9', 'Drake London', 'WR', 'ATL', 12, 'healthy'),
      'bench',
      'BN',
    ),
    slot('rs-10', 'tm-nfl-1', player('pl-10', 'Tyreek Hill', 'WR', 'MIA', 6, 'ir'), 'ir', 'IR'),
  ],
  'tm-nba-1': [
    slot(
      'rs-20',
      'tm-nba-1',
      player('pl-20', 'Luka Doncic', 'PG', 'DAL', null, 'healthy'),
      'starter',
      'PG',
    ),
    slot(
      'rs-21',
      'tm-nba-1',
      player('pl-21', 'Jayson Tatum', 'SF', 'BOS', null, 'questionable'),
      'starter',
      'SF',
    ),
    slot(
      'rs-22',
      'tm-nba-1',
      player('pl-22', 'Nikola Jokic', 'C', 'DEN', null, 'healthy'),
      'starter',
      'C',
    ),
    slot(
      'rs-23',
      'tm-nba-1',
      player('pl-23', 'Devin Booker', 'SG', 'PHX', null, 'healthy'),
      'bench',
      'BN',
    ),
  ],
};

export function rosterFor(teamId: string): RosterSlot[] {
  if (rosters[teamId]) return rosters[teamId];
  // Generic fallback roster for leagues without seeded detail.
  return [
    slot(
      `rs-${teamId}-1`,
      teamId,
      player(`pl-${teamId}-1`, 'Joe Burrow', 'QB', 'CIN', 10, 'healthy'),
      'starter',
      'QB',
    ),
    slot(
      `rs-${teamId}-2`,
      teamId,
      player(`pl-${teamId}-2`, 'Ja’Marr Chase', 'WR', 'CIN', 11, 'healthy'),
      'starter',
      'WR',
    ),
    slot(
      `rs-${teamId}-3`,
      teamId,
      player(`pl-${teamId}-3`, 'Breece Hall', 'RB', 'NYJ', 12, 'healthy'),
      'bench',
      'BN',
    ),
  ];
}

export function standingsFor(leagueId: string): StandingRow[] {
  const mine = myTeams.find((t) => t.leagueId === leagueId);
  const other = opponents[leagueId];
  const league = leagues.find((l) => l.id === leagueId);
  if (!mine || !other || !league) return [];
  const filler: Team[] = Array.from({ length: league.totalTeams - 2 }, (_, i) =>
    opp(`tm-fill-${leagueId}-${i}`, leagueId, `Team ${i + 3}`, `Owner ${i + 3}`),
  );
  const all = [mine, other, ...filler].sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
  return all.map((team, i) => ({ rank: i + 1, team }));
}
