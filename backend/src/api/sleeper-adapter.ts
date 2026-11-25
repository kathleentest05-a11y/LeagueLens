// Sleeper adapter stub (issue #5 scope, stubbed per problem.txt)
// Real implementation in issue #5 with rate limiter and actual HTTP calls
// This stub returns fixture data for development

import type { Sport } from '../generated/prisma';

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar?: string;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  sport: string;
  season: string;
  status: string;
  total_rosters: number;
  settings: Record<string, unknown>;
  scoring_settings: Record<string, unknown>;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[];
  starters: string[];
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
  };
}

export interface SleeperLeagueUser {
  user_id: string;
  display_name: string;
  metadata?: {
    team_name?: string;
  };
}

export interface SleeperMatchup {
  matchup_id: number;
  roster_id: number;
  points: number;
  players_points?: Record<string, number>;
}

export interface SleeperPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team?: string;
  injury_status?: string;
  status?: string;
}

export interface SleeperLeagueBundle {
  league: SleeperLeague;
  rosters: SleeperRoster[];
  users: SleeperLeagueUser[];
  currentWeekMatchups: SleeperMatchup[];
}

/**
 * Sleeper adapter interface (PRD §6.2)
 * Real implementation will handle rate limiting, caching, retries, etc.
 */
export interface SleeperAdapter {
  /**
   * Resolve a Sleeper username to user object
   * Returns null if user not found (SLEEPER_USER_NOT_FOUND)
   */
  resolveUser(username: string): Promise<SleeperUser | null>;

  /**
   * List all leagues for a user in a sport/season
   * Returns empty array for zero leagues (SLEEPER_NO_LEAGUES)
   */
  listLeagues(userId: string, sport: Sport, season: string): Promise<SleeperLeague[]>;

  /**
   * Fetch complete league bundle (league + rosters + users + current week matchups)
   * Used for sync operations
   */
  getLeagueBundle(leagueId: string, currentWeek: number): Promise<SleeperLeagueBundle>;

  /**
   * Fetch player directory for a sport
   * Cached daily, never per-user/per-league (TDD §4.2)
   */
  getPlayers(sport: Sport): Promise<Record<string, SleeperPlayer>>;
}

/**
 * Stub implementation returning fixture data
 * Real implementation in issue #5
 */
export class StubSleeperAdapter implements SleeperAdapter {
  async resolveUser(username: string): Promise<SleeperUser | null> {
    // Stub: treat certain usernames as "not found"
    if (username === 'nonexistent' || username === 'unknown') {
      return null;
    }

    // Return a fixture user
    return {
      user_id: `stub_user_${username}`,
      username,
      display_name: `${username} (stub)`,
      avatar: undefined,
    };
  }

  async listLeagues(userId: string, sport: Sport, season: string): Promise<SleeperLeague[]> {
    // Stub: return empty array for certain users (zero leagues case)
    if (userId.includes('no_leagues')) {
      return [];
    }

    // Return fixture leagues
    return [
      {
        league_id: `stub_league_1_${userId}`,
        name: `${sport.toUpperCase()} League ${season}`,
        sport: sport,
        season,
        status: 'in_season',
        total_rosters: 10,
        settings: {},
        scoring_settings: {},
      },
    ];
  }

  async getLeagueBundle(leagueId: string, currentWeek: number): Promise<SleeperLeagueBundle> {
    // Return minimal fixture bundle
    return {
      league: {
        league_id: leagueId,
        name: 'Stub League',
        sport: 'nfl',
        season: '2024',
        status: 'in_season',
        total_rosters: 10,
        settings: {},
        scoring_settings: {},
      },
      rosters: [
        {
          roster_id: 1,
          owner_id: 'stub_user_1',
          players: ['player_1', 'player_2'],
          starters: ['player_1'],
          settings: {
            wins: 5,
            losses: 3,
            ties: 0,
            fpts: 850.5,
          },
        },
      ],
      users: [
        {
          user_id: 'stub_user_1',
          display_name: 'Stub User 1',
          metadata: {
            team_name: 'Stub Team',
          },
        },
      ],
      currentWeekMatchups: [],
    };
  }

  async getPlayers(sport: Sport): Promise<Record<string, SleeperPlayer>> {
    // Return minimal fixture player directory
    return {
      player_1: {
        player_id: 'player_1',
        full_name: 'John Doe',
        position: 'QB',
        team: 'KC',
        injury_status: undefined,
        status: 'Active',
      },
      player_2: {
        player_id: 'player_2',
        full_name: 'Jane Smith',
        position: 'RB',
        team: 'SF',
        injury_status: undefined,
        status: 'Active',
      },
    };
  }
}
