import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { loadConfig } from './config';

// Shared Prisma client (TDD Section 6.2). Created lazily so importing this
// module never connects — or fails on a missing DATABASE_URL — before a
// caller actually queries. The instance is cached on globalThis so
// `tsx watch` reloads in dev do not leak a new client per reload.
//
// Prisma 7 takes no connection URL in the schema or constructor: the
// runtime goes through the pg driver adapter, fed from the validated
// config (an explicit argument wins, e.g. TEST_DATABASE_URL in the
// integration test). `connectionTimeoutMillis` restores Prisma 6's 5s
// connect timeout; the pg driver defaults to waiting forever.
const globalForPrisma = globalThis as unknown as { leaguelensPrisma?: PrismaClient };

export function createDb(databaseUrl?: string): PrismaClient {
  const connectionString = databaseUrl ?? loadConfig().databaseUrl;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL: cannot create a Prisma client without it');
  }
  const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 });
  return new PrismaClient({ adapter });
}

export function getDb(): PrismaClient {
  globalForPrisma.leaguelensPrisma ??= createDb();
  return globalForPrisma.leaguelensPrisma;
}

export async function disconnectDb(): Promise<void> {
  if (globalForPrisma.leaguelensPrisma) {
    await globalForPrisma.leaguelensPrisma.$disconnect();
    globalForPrisma.leaguelensPrisma = undefined;
  }
}
