// Tests for domain resolvers
// Covers: auth scoping, error codes, no live provider call from query resolvers

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolvers } from './resolvers';
import { ErrorCode } from './errors';
import type { GraphQLContext } from './context';
import type { PrismaClient } from '../generated/prisma';
import type { SleeperAdapter } from './sleeper-adapter';

describe('Query Resolvers - Auth Scoping', () => {
  let mockPrisma: PrismaClient;
  let mockSleeperAdapter: SleeperAdapter;
  let ctx: GraphQLContext;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
      },
      providerConnection: {
        findMany: vi.fn(),
      },
      team: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      league: {
        findUnique: vi.fn(),
      },
      matchup: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      alert: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    } as unknown as PrismaClient;

    mockSleeperAdapter = {
      resolveUser: vi.fn(),
      listLeagues: vi.fn(),
      getLeagueBundle: vi.fn(),
      getPlayers: vi.fn(),
    };

    ctx = {
      userId: 'user-123',
      firebaseUid: 'firebase-123',
      prisma: mockPrisma,
      sleeperAdapter: mockSleeperAdapter,
      leagueRefreshLimiter: {} as any,
      connectSleeperLimiter: {} as any,
    };
  });

  describe('me query', () => {
    it('should return null when not authenticated', async () => {
      const unauthCtx = { ...ctx, userId: null };
      const result = await resolvers.Query.me(null, {}, unauthCtx);
      expect(result).toBeNull();
    });

    it('should return user when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      };
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await resolvers.Query.me(null, {}, ctx);
      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        include: {
          connections: {
            include: {
              leagues: true,
            },
          },
        },
      });
    });
  });

  describe('dashboard query', () => {
    it('should require authentication', async () => {
      const unauthCtx = { ...ctx, userId: null };
      await expect(resolvers.Query.dashboard(null, {}, unauthCtx)).rejects.toMatchObject({
        extensions: { code: ErrorCode.UNAUTHENTICATED },
      });
    });

    it('should only return teams for authenticated user', async () => {
      vi.mocked(mockPrisma.providerConnection.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.alert.count).mockResolvedValue(0);

      await resolvers.Query.dashboard(null, {}, ctx);

      expect(mockPrisma.providerConnection.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: expect.any(Object),
      });
    });

    it('should not call provider adapter', async () => {
      vi.mocked(mockPrisma.providerConnection.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.alert.count).mockResolvedValue(0);

      await resolvers.Query.dashboard(null, {}, ctx);

      // Query resolvers must read DB only (TDD §2.2)
      expect(mockSleeperAdapter.resolveUser).not.toHaveBeenCalled();
      expect(mockSleeperAdapter.listLeagues).not.toHaveBeenCalled();
      expect(mockSleeperAdapter.getLeagueBundle).not.toHaveBeenCalled();
      expect(mockSleeperAdapter.getPlayers).not.toHaveBeenCalled();
    });
  });

  describe('team query', () => {
    it('should require authentication', async () => {
      const unauthCtx = { ...ctx, userId: null };
      await expect(resolvers.Query.team(null, { id: 'team-123' }, unauthCtx)).rejects.toMatchObject({
        extensions: { code: ErrorCode.UNAUTHENTICATED },
      });
    });

    it('should return NOT_FOUND for nonexistent team', async () => {
      vi.mocked(mockPrisma.team.findUnique).mockResolvedValue(null);

      await expect(resolvers.Query.team(null, { id: 'team-123' }, ctx)).rejects.toMatchObject({
        extensions: { code: ErrorCode.NOT_FOUND },
        message: expect.stringContaining('Team'),
      });
    });

    it('should reject access to another users team', async () => {
      const otherUsersTeam = {
        id: 'team-123',
        league: {
          connection: {
            userId: 'user-456', // Different user
          },
        },
      };
      vi.mocked(mockPrisma.team.findUnique).mockResolvedValue(otherUsersTeam as any);

      await expect(resolvers.Query.team(null, { id: 'team-123' }, ctx)).rejects.toMatchObject({
        extensions: { code: ErrorCode.UNAUTHENTICATED },
        message: expect.stringContaining('Access denied'),
      });
    });

    it('should not call provider adapter', async () => {
      const mockTeam = {
        id: 'team-123',
        leagueId: 'league-123',
        league: {
          connection: {
            userId: 'user-123',
          },
          currentWeek: 1,
        },
      };
      vi.mocked(mockPrisma.team.findUnique).mockResolvedValue(mockTeam as any);
      vi.mocked(mockPrisma.matchup.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.matchup.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.team.findMany).mockResolvedValue([]);

      await resolvers.Query.team(null, { id: 'team-123' }, ctx);

      // Query resolvers must read DB only
      expect(mockSleeperAdapter.resolveUser).not.toHaveBeenCalled();
      expect(mockSleeperAdapter.listLeagues).not.toHaveBeenCalled();
      expect(mockSleeperAdapter.getLeagueBundle).not.toHaveBeenCalled();
    });
  });

  describe('alerts query', () => {
    it('should require authentication', async () => {
      const unauthCtx = { ...ctx, userId: null };
      await expect(resolvers.Query.alerts(null, {}, unauthCtx)).rejects.toMatchObject({
        extensions: { code: ErrorCode.UNAUTHENTICATED },
      });
    });

    it('should only return alerts for authenticated user', async () => {
      vi.mocked(mockPrisma.alert.findMany).mockResolvedValue([]);

      await resolvers.Query.alerts(null, {}, ctx);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it('should filter by status when provided', async () => {
      vi.mocked(mockPrisma.alert.findMany).mockResolvedValue([]);

      await resolvers.Query.alerts(null, { status: 'open' }, ctx);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-123',
            status: 'open',
          },
        }),
      );
    });
  });
});

describe('Mutation Resolvers - Error Codes', () => {
  let mockPrisma: PrismaClient;
  let mockSleeperAdapter: SleeperAdapter;
  let ctx: GraphQLContext;

  beforeEach(() => {
    mockPrisma = {
      providerConnection: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
      },
      league: {
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      alert: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
    } as unknown as PrismaClient;

    mockSleeperAdapter = {
      resolveUser: vi.fn(),
      listLeagues: vi.fn(),
      getLeagueBundle: vi.fn(),
      getPlayers: vi.fn(),
    };

    ctx = {
      userId: 'user-123',
      firebaseUid: 'firebase-123',
      prisma: mockPrisma,
      sleeperAdapter: mockSleeperAdapter,
      leagueRefreshLimiter: {
        checkAllowed: vi.fn().mockResolvedValue(true),
        recordAction: vi.fn(),
        getRetryAfter: vi.fn().mockResolvedValue(0),
      } as any,
      connectSleeperLimiter: {
        checkAllowed: vi.fn().mockResolvedValue(true),
        recordAction: vi.fn(),
        getRetryAfter: vi.fn().mockResolvedValue(0),
      } as any,
    };
  });

  describe('connectSleeper mutation', () => {
    it('should return SLEEPER_USER_NOT_FOUND for unknown username', async () => {
      vi.mocked(mockSleeperAdapter.resolveUser).mockResolvedValue(null);

      await expect(
        resolvers.Mutation.connectSleeper(null, { username: 'unknown' }, ctx),
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.SLEEPER_USER_NOT_FOUND },
        message: expect.stringContaining('unknown'),
      });
    });

    it('should return SLEEPER_NO_LEAGUES when user has zero leagues', async () => {
      vi.mocked(mockSleeperAdapter.resolveUser).mockResolvedValue({
        user_id: 'sleeper-123',
        username: 'testuser',
        display_name: 'Test User',
      });
      vi.mocked(mockSleeperAdapter.listLeagues).mockResolvedValue([]);

      await expect(
        resolvers.Mutation.connectSleeper(null, { username: 'testuser' }, ctx),
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.SLEEPER_NO_LEAGUES },
        message: expect.stringContaining('testuser'),
      });
    });

    it('should call bounded username lookup (the only allowed API-side provider call)', async () => {
      vi.mocked(mockSleeperAdapter.resolveUser).mockResolvedValue({
        user_id: 'sleeper-123',
        username: 'testuser',
        display_name: 'Test User',
      });
      vi.mocked(mockSleeperAdapter.listLeagues).mockResolvedValue([
        {
          league_id: 'league-1',
          name: 'Test League',
          sport: 'nfl',
          season: '2024',
          status: 'in_season',
          total_rosters: 10,
          settings: {},
          scoring_settings: {},
        },
      ]);
      vi.mocked(mockPrisma.providerConnection.upsert).mockResolvedValue({
        id: 'conn-123',
        userId: 'user-123',
        provider: 'sleeper',
      } as any);

      await resolvers.Mutation.connectSleeper(null, { username: 'testuser' }, ctx);

      // Bounded lookup is allowed per TDD §2.2
      expect(mockSleeperAdapter.resolveUser).toHaveBeenCalledWith('testuser');
      expect(mockSleeperAdapter.listLeagues).toHaveBeenCalled();
    });
  });

  describe('disconnectProvider mutation', () => {
    it('should return NOT_FOUND for nonexistent connection', async () => {
      vi.mocked(mockPrisma.providerConnection.findUnique).mockResolvedValue(null);

      await expect(
        resolvers.Mutation.disconnectProvider(null, { connectionId: 'conn-123' }, ctx),
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.NOT_FOUND },
        message: expect.stringContaining('Connection'),
      });
    });

    it('should reject disconnecting another users connection', async () => {
      vi.mocked(mockPrisma.providerConnection.findUnique).mockResolvedValue({
        id: 'conn-123',
        userId: 'user-456', // Different user
      } as any);

      await expect(
        resolvers.Mutation.disconnectProvider(null, { connectionId: 'conn-123' }, ctx),
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.UNAUTHENTICATED },
        message: expect.stringContaining('Access denied'),
      });
    });
  });

  describe('refreshLeague mutation', () => {
    it('should return NOT_FOUND for nonexistent league', async () => {
      vi.mocked(mockPrisma.league.findUnique).mockResolvedValue(null);

      await expect(
        resolvers.Mutation.refreshLeague(null, { leagueId: 'league-123' }, ctx),
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.NOT_FOUND },
        message: expect.stringContaining('League'),
      });
    });

    it('should enforce per-league cooldown', async () => {
      vi.mocked(mockPrisma.league.findUnique).mockResolvedValue({
        id: 'league-123',
        connection: { userId: 'user-123' },
        lastSyncAt: new Date(),
      } as any);
      
      vi.mocked(ctx.leagueRefreshLimiter.checkAllowed).mockResolvedValue(false);
      vi.mocked(ctx.leagueRefreshLimiter.getRetryAfter).mockResolvedValue(180);

      await expect(
        resolvers.Mutation.refreshLeague(null, { leagueId: 'league-123' }, ctx),
      ).rejects.toMatchObject({
        extensions: {
          code: ErrorCode.REFRESH_COOLDOWN,
          retryAfterSeconds: expect.any(Number),
        },
      });
    });
  });
});
