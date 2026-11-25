// M1 domain resolvers (TDD §2.1)
// All resolvers scope to ctx.userId (TDD §2.2)
// Resolvers read normalized DB only (no provider passthrough except bounded connectSleeper lookup)

import type { GraphQLContext } from './context';
import { requireAuth, assertOwnership } from './scoping';
import {
  NotFoundError,
  SleeperUserNotFoundError,
  SleeperNoLeaguesError,
  ProviderUnavailableError,
} from './errors';
import { LeagueRefreshLimiter, ConnectSleeperLimiter } from './rate-limiter';
import type {
  User,
  ProviderConnection,
  League,
  Team,
  Alert,
  AlertStatus,
  Sport,
  Provider,
} from '../generated/prisma';

// Input types from schema
interface DashboardFilter {
  sport?: Sport;
  status?: string;
}

interface AlertPreferencesInput {
  enableEmail?: boolean;
  enablePush?: boolean;
}

// Sync state helper
function computeSyncState(lastSyncAt: Date | null) {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  const thirtyMinutesAgo = now - 30 * 60 * 1000;

  const lastSyncTime = lastSyncAt?.getTime() ?? 0;
  const isStale = lastSyncTime < thirtyMinutesAgo;
  const canRefresh = lastSyncTime < fiveMinutesAgo;
  const refreshCooldownSeconds = canRefresh
    ? 0
    : Math.ceil((lastSyncTime + 5 * 60 * 1000 - now) / 1000);

  return {
    isStale,
    lastSyncAt,
    canRefresh,
    refreshCooldownSeconds,
  };
}

export const resolvers = {
  // Scalar resolvers
  DateTime: {
    __parseValue(value: string): Date {
      return new Date(value);
    },
    __serialize(value: Date): string {
      return value.toISOString();
    },
    __parseLiteral(ast: { kind: string; value: string }): Date | null {
      if (ast.kind === 'StringValue') {
        return new Date(ast.value);
      }
      return null;
    },
  },

  JSON: {
    __parseValue(value: unknown): unknown {
      return value;
    },
    __serialize(value: unknown): unknown {
      return value;
    },
    __parseLiteral(ast: { kind: string; value: unknown }): unknown {
      return ast.value;
    },
  },

  Query: {
    // Health check (M0)
    health: () => ({
      status: 'ok',
      service: 'api',
      version: '0.1.0',
    }),

    // Get current authenticated user
    me: async (_parent: unknown, _args: unknown, ctx: GraphQLContext): Promise<User | null> => {
      if (!ctx.userId) {
        return null;
      }

      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        include: {
          connections: {
            include: {
              leagues: true,
            },
          },
        },
      });

      return user;
    },

    // Dashboard query (shaped around dashboard screen)
    dashboard: async (
      _parent: unknown,
      args: { filter?: DashboardFilter },
      ctx: GraphQLContext,
    ) => {
      const userId = requireAuth(ctx);

      // Fetch all teams for this user via their connections
      const connections = await ctx.prisma.providerConnection.findMany({
        where: { userId },
        include: {
          leagues: {
            where: args.filter?.sport ? { sport: args.filter.sport } : undefined,
            include: {
              teams: {
                where: { isMine: true },
                include: {
                  alerts: {
                    where: { status: 'open' },
                  },
                  league: true,
                },
              },
            },
          },
        },
      });

      // Flatten to teams
      const myTeams = connections.flatMap((conn) =>
        conn.leagues.flatMap((league) => league.teams),
      );

      // Build team cards (sorted: needs-attention first per TDD)
      const teamCards = await Promise.all(
        myTeams.map(async (team) => {
          const league = await ctx.prisma.league.findUnique({
            where: { id: team.leagueId },
          });

          if (!league) {
            throw NotFoundError('League');
          }

          // Find current week matchup
          const matchup = await ctx.prisma.matchup.findFirst({
            where: {
              leagueId: team.leagueId,
              week: league.currentWeek,
              OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
            },
            include: {
              homeTeam: true,
              awayTeam: true,
            },
          });

          return {
            team,
            league,
            matchup,
            alerts: team.alerts,
            syncState: computeSyncState(league.lastSyncAt),
          };
        }),
      );

      // Sort: teams with open alerts first
      teamCards.sort((a, b) => b.alerts.length - a.alerts.length);

      // Count open alerts
      const openAlertCount = await ctx.prisma.alert.count({
        where: {
          userId,
          status: 'open',
        },
      });

      // Find most recent sync
      const allSyncDates = connections
        .flatMap((c) => c.leagues)
        .map((l) => l.lastSyncAt)
        .filter((d): d is Date => d !== null);

      const lastSyncedAt = allSyncDates.length > 0 ? new Date(Math.max(...allSyncDates.map(d => d.getTime()))) : null;

      return {
        teams: teamCards,
        openAlertCount,
        lastSyncedAt,
      };
    },

    // Team detail query
    team: async (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx);

      const team = await ctx.prisma.team.findUnique({
        where: { id: args.id },
        include: {
          league: {
            include: {
              connection: true,
            },
          },
          rosterSlots: {
            include: {
              player: true,
            },
          },
        },
      });

      if (!team) {
        throw NotFoundError('Team');
      }

      // Verify ownership via connection
      assertOwnership(ctx, team.league.connection.userId, 'Team');

      // Current matchup
      const matchup = await ctx.prisma.matchup.findFirst({
        where: {
          leagueId: team.leagueId,
          week: team.league.currentWeek,
          OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
        },
        include: {
          homeTeam: true,
          awayTeam: true,
        },
      });

      // Recent matchups (last 3 weeks)
      const recentMatchups = await ctx.prisma.matchup.findMany({
        where: {
          leagueId: team.leagueId,
          week: {
            lt: team.league.currentWeek,
            gte: Math.max(1, team.league.currentWeek - 3),
          },
          OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
        },
        include: {
          homeTeam: true,
          awayTeam: true,
        },
        orderBy: {
          week: 'desc',
        },
        take: 3,
      });

      // Standings (all teams in league)
      const standings = await ctx.prisma.team.findMany({
        where: { leagueId: team.leagueId },
        orderBy: [{ wins: 'desc' }, { pointsFor: 'desc' }],
      });

      return {
        team,
        league: team.league,
        matchup,
        recentMatchups,
        standings,
      };
    },

    // Alerts query
    alerts: async (
      _parent: unknown,
      args: { status?: AlertStatus },
      ctx: GraphQLContext,
    ): Promise<Alert[]> => {
      const userId = requireAuth(ctx);

      const alerts = await ctx.prisma.alert.findMany({
        where: {
          userId,
          ...(args.status ? { status: args.status } : {}),
        },
        include: {
          team: true,
          player: true,
        },
        orderBy: [{ createdAt: 'desc' }],
      });

      return alerts;
    },
  },

  Mutation: {
    // Connect Sleeper account
    connectSleeper: async (
      _parent: unknown,
      args: { username: string },
      ctx: GraphQLContext,
    ): Promise<ProviderConnection> => {
      const userId = requireAuth(ctx);

      // Rate limit: 3 attempts per 10 minutes per user
      const connectLimiter = new ConnectSleeperLimiter();
      await connectLimiter.checkAndRecord(userId);

      // Bounded username lookup (the only allowed API-side provider call per TDD)
      const sleeperUser = await ctx.sleeperAdapter.resolveUser(args.username);

      if (!sleeperUser) {
        throw SleeperUserNotFoundError(args.username);
      }

      // List current season NFL leagues
      const currentSeason = new Date().getFullYear().toString();
      const leagues = await ctx.sleeperAdapter.listLeagues(
        sleeperUser.user_id,
        'nfl',
        currentSeason,
      );

      if (leagues.length === 0) {
        throw SleeperNoLeaguesError(args.username);
      }

      // Upsert connection
      const connection = await ctx.prisma.providerConnection.upsert({
        where: {
          userId_provider_externalUserId: {
            userId,
            provider: 'sleeper',
            externalUserId: sleeperUser.user_id,
          },
        },
        create: {
          userId,
          provider: 'sleeper',
          externalUserId: sleeperUser.user_id,
          handle: sleeperUser.username,
          status: 'connected',
        },
        update: {
          handle: sleeperUser.username,
          status: 'connected',
          updatedAt: new Date(),
        },
        include: {
          leagues: true,
        },
      });

      // In real implementation (issue #5), we would enqueue sync jobs here
      // For now, the stub is sufficient to demonstrate the flow

      return connection;
    },

    // Disconnect provider
    disconnectProvider: async (
      _parent: unknown,
      args: { connectionId: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const userId = requireAuth(ctx);

      const connection = await ctx.prisma.providerConnection.findUnique({
        where: { id: args.connectionId },
      });

      if (!connection) {
        throw NotFoundError('Connection');
      }

      assertOwnership(ctx, connection.userId, 'Connection');

      // Delete removes cached data via cascade (FR-1.4)
      await ctx.prisma.providerConnection.delete({
        where: { id: args.connectionId },
      });

      return true;
    },

    // Refresh league
    refreshLeague: async (
      _parent: unknown,
      args: { leagueId: string },
      ctx: GraphQLContext,
    ) => {
      const userId = requireAuth(ctx);

      const league = await ctx.prisma.league.findUnique({
        where: { id: args.leagueId },
        include: {
          connection: true,
        },
      });

      if (!league) {
        throw NotFoundError('League');
      }

      assertOwnership(ctx, league.connection.userId, 'League');

      // Per-league cooldown (5 minutes)
      const refreshLimiter = new LeagueRefreshLimiter(ctx.leagueRefreshLimiter);
      await refreshLimiter.checkAndRecord(args.leagueId);

      // In real implementation (issue #5), enqueue sync job here
      // For now, return success with current sync state
      const syncState = computeSyncState(league.lastSyncAt);

      return {
        success: true,
        message: 'Refresh queued (stub: real sync in issue #5)',
        syncState,
      };
    },

    // Delete league
    deleteLeague: async (
      _parent: unknown,
      args: { leagueId: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const userId = requireAuth(ctx);

      const league = await ctx.prisma.league.findUnique({
        where: { id: args.leagueId },
        include: {
          connection: true,
        },
      });

      if (!league) {
        throw NotFoundError('League');
      }

      assertOwnership(ctx, league.connection.userId, 'League');

      // Delete removes cached data via cascade (FR-1.4)
      await ctx.prisma.league.delete({
        where: { id: args.leagueId },
      });

      return true;
    },

    // Acknowledge alert
    acknowledgeAlert: async (
      _parent: unknown,
      args: { alertId: string },
      ctx: GraphQLContext,
    ): Promise<Alert> => {
      const userId = requireAuth(ctx);

      const alert = await ctx.prisma.alert.findUnique({
        where: { id: args.alertId },
      });

      if (!alert) {
        throw NotFoundError('Alert');
      }

      assertOwnership(ctx, alert.userId, 'Alert');

      const updated = await ctx.prisma.alert.update({
        where: { id: args.alertId },
        data: {
          status: 'acknowledged',
          acknowledgedAt: new Date(),
        },
        include: {
          team: true,
          player: true,
        },
      });

      return updated;
    },

    // Update alert preferences
    updateAlertPreferences: async (
      _parent: unknown,
      args: { input: AlertPreferencesInput },
      ctx: GraphQLContext,
    ): Promise<User> => {
      const userId = requireAuth(ctx);

      // Note: User model doesn't have alert preferences yet
      // This is a placeholder for future implementation
      // For now, just return the user unchanged
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        include: {
          connections: {
            include: {
              leagues: true,
            },
          },
        },
      });

      if (!user) {
        throw NotFoundError('User');
      }

      return user;
    },
  },

  // Type resolvers for nested fields
  User: {
    connections: async (parent: User, _args: unknown, ctx: GraphQLContext) => {
      return ctx.prisma.providerConnection.findMany({
        where: { userId: parent.id },
        include: {
          leagues: true,
        },
      });
    },
  },

  ProviderConnection: {
    leagues: async (parent: ProviderConnection, _args: unknown, ctx: GraphQLContext) => {
      return ctx.prisma.league.findMany({
        where: { connectionId: parent.id },
      });
    },
  },

  League: {
    teams: async (parent: League, _args: unknown, ctx: GraphQLContext) => {
      return ctx.prisma.team.findMany({
        where: { leagueId: parent.id },
      });
    },
  },

  Team: {
    rosterSlots: async (parent: Team, _args: unknown, ctx: GraphQLContext) => {
      return ctx.prisma.rosterSlot.findMany({
        where: { teamId: parent.id },
        include: {
          player: true,
        },
        orderBy: [{ slotType: 'asc' }, { slotIndex: 'asc' }],
      });
    },
    alerts: async (parent: Team, _args: unknown, ctx: GraphQLContext) => {
      return ctx.prisma.alert.findMany({
        where: {
          teamId: parent.id,
          status: 'open',
        },
      });
    },
  },

  Matchup: {
    homeTeam: async (parent: { homeTeamId: string }, _args: unknown, ctx: GraphQLContext) => {
      const team = await ctx.prisma.team.findUnique({
        where: { id: parent.homeTeamId },
      });
      if (!team) throw NotFoundError('Team');
      return team;
    },
    awayTeam: async (
      parent: { awayTeamId: string | null },
      _args: unknown,
      ctx: GraphQLContext,
    ) => {
      if (!parent.awayTeamId) return null;
      return ctx.prisma.team.findUnique({
        where: { id: parent.awayTeamId },
      });
    },
  },

  Alert: {
    player: async (parent: Alert, _args: unknown, ctx: GraphQLContext) => {
      if (!parent.playerId) return null;
      return ctx.prisma.player.findUnique({
        where: { id: parent.playerId },
      });
    },
  },

  RosterSlot: {
    player: async (parent: { playerId: string | null }, _args: unknown, ctx: GraphQLContext) => {
      if (!parent.playerId) return null;
      return ctx.prisma.player.findUnique({
        where: { id: parent.playerId },
      });
    },
  },
};
