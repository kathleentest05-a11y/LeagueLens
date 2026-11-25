// DataLoader stubs for N+1 prevention (TDD §2.1)
// Real implementation when optimizing query performance

import DataLoader from 'dataloader';
import type { PrismaClient } from '../generated/prisma';

/**
 * Create DataLoaders for batching database queries
 * Prevents N+1 queries when resolving nested fields
 * 
 * Usage in context:
 * const loaders = createDataLoaders(prisma);
 * ctx.loaders = loaders;
 * 
 * In resolver:
 * const player = await ctx.loaders.player.load(playerId);
 */
export function createDataLoaders(prisma: PrismaClient) {
  return {
    // Player loader: batch load players by ID
    player: new DataLoader(async (ids: readonly string[]) => {
      const players = await prisma.player.findMany({
        where: { id: { in: [...ids] } },
      });

      // Return in same order as requested IDs
      const playerMap = new Map(players.map((p) => [p.id, p]));
      return ids.map((id) => playerMap.get(id) ?? null);
    }),

    // Team loader: batch load teams by ID
    team: new DataLoader(async (ids: readonly string[]) => {
      const teams = await prisma.team.findMany({
        where: { id: { in: [...ids] } },
      });

      const teamMap = new Map(teams.map((t) => [t.id, t]));
      return ids.map((id) => teamMap.get(id) ?? null);
    }),

    // League loader: batch load leagues by ID
    league: new DataLoader(async (ids: readonly string[]) => {
      const leagues = await prisma.league.findMany({
        where: { id: { in: [...ids] } },
      });

      const leagueMap = new Map(leagues.map((l) => [l.id, l]));
      return ids.map((id) => leagueMap.get(id) ?? null);
    }),

    // Alert loader: batch load alerts by team ID
    alertsByTeam: new DataLoader(async (teamIds: readonly string[]) => {
      const alerts = await prisma.alert.findMany({
        where: {
          teamId: { in: [...teamIds] },
          status: 'open',
        },
      });

      // Group by team ID
      const alertsByTeamMap = new Map<string, typeof alerts>();
      for (const alert of alerts) {
        const existing = alertsByTeamMap.get(alert.teamId) ?? [];
        existing.push(alert);
        alertsByTeamMap.set(alert.teamId, existing);
      }

      return teamIds.map((id) => alertsByTeamMap.get(id) ?? []);
    }),

    // Roster slots loader: batch load roster slots by team ID
    rosterSlotsByTeam: new DataLoader(async (teamIds: readonly string[]) => {
      const slots = await prisma.rosterSlot.findMany({
        where: {
          teamId: { in: [...teamIds] },
        },
        include: {
          player: true,
        },
        orderBy: [{ slotType: 'asc' }, { slotIndex: 'asc' }],
      });

      // Group by team ID
      const slotsByTeamMap = new Map<string, typeof slots>();
      for (const slot of slots) {
        const existing = slotsByTeamMap.get(slot.teamId) ?? [];
        existing.push(slot);
        slotsByTeamMap.set(slot.teamId, existing);
      }

      return teamIds.map((id) => slotsByTeamMap.get(id) ?? []);
    }),
  };
}

export type DataLoaders = ReturnType<typeof createDataLoaders>;

/**
 * To integrate DataLoaders into resolvers:
 * 
 * 1. Add DataLoader dependency:
 *    npm install dataloader -w @leaguelens/backend
 * 
 * 2. Update context.ts:
 *    import { createDataLoaders, type DataLoaders } from './dataloaders';
 *    
 *    export interface GraphQLContext {
 *      // ... existing fields
 *      loaders: DataLoaders;
 *    }
 *    
 *    export async function createGraphQLContext(...) {
 *      // ... existing code
 *      return {
 *        // ... existing fields
 *        loaders: createDataLoaders(deps.prisma),
 *      };
 *    }
 * 
 * 3. Update resolvers to use loaders instead of direct Prisma calls:
 *    // Before:
 *    const player = await ctx.prisma.player.findUnique({ where: { id: playerId } });
 *    
 *    // After:
 *    const player = await ctx.loaders.player.load(playerId);
 * 
 * 4. Update Team.alerts resolver:
 *    alerts: async (parent, _args, ctx) => {
 *      return ctx.loaders.alertsByTeam.load(parent.id);
 *    },
 * 
 * Benefits:
 * - Batches multiple individual loads into single query
 * - Caches results within the same request
 * - Significantly reduces database round-trips
 * - Critical for dashboard query p95 < 500ms (PRD §14)
 */
