// Apollo context (TDD §2.2)
// Every resolver receives this context with userId scoping

import type { PrismaClient } from '../generated/prisma';
import type { SleeperAdapter } from './sleeper-adapter';
import type { TokenVerifier } from './auth';
import type { InMemoryRateLimiter } from './rate-limiter';
import { createAuthContext, type AuthContext } from './auth';

export interface GraphQLContext extends AuthContext {
  prisma: PrismaClient;
  sleeperAdapter: SleeperAdapter;
  leagueRefreshLimiter: InMemoryRateLimiter;
  connectSleeperLimiter: InMemoryRateLimiter;
}

export interface ContextFactoryDeps {
  prisma: PrismaClient;
  tokenVerifier: TokenVerifier;
  sleeperAdapter: SleeperAdapter;
  leagueRefreshLimiter: InMemoryRateLimiter;
  connectSleeperLimiter: InMemoryRateLimiter;
}

/**
 * Create the GraphQL context for each request
 * Verifies auth and sets userId for resolver scoping
 */
export async function createGraphQLContext(
  req: { headers: Record<string, string | string[] | undefined> },
  deps: ContextFactoryDeps,
): Promise<GraphQLContext> {
  const authHeader = req.headers.authorization as string | undefined;

  const authContext = await createAuthContext(authHeader, deps.tokenVerifier, deps.prisma);

  return {
    ...authContext,
    prisma: deps.prisma,
    sleeperAdapter: deps.sleeperAdapter,
    leagueRefreshLimiter: deps.leagueRefreshLimiter,
    connectSleeperLimiter: deps.connectSleeperLimiter,
  };
}
