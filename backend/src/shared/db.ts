import { PrismaClient } from '@prisma/client';

// Shared Prisma client (TDD Section 6.2). Created lazily so importing this
// module never connects — or fails on a missing DATABASE_URL — before a
// caller actually queries. The instance is cached on globalThis so
// `tsx watch` reloads in dev do not leak a new client per reload.
const globalForPrisma = globalThis as unknown as { leaguelensPrisma?: PrismaClient };

export function createDb(databaseUrl?: string): PrismaClient {
  return new PrismaClient(databaseUrl ? { datasourceUrl: databaseUrl } : undefined);
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
