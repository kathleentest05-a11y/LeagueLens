// Prisma CLI config (Prisma 7): Migrate/introspection connection URL.
// The runtime client never reads this file — it gets its URL through the
// driver adapter in `src/shared/db.ts`, sourced from `loadConfig()`.
//
// Env-file precedence mirrors `src/shared/env.ts`: a variable already set
// in the real environment (Compose, CI, shell) always wins, and `.env.local`
// wins over `.env` (dotenv never overrides an already-set variable, so
// loading in this order gives that precedence). Values are never logged.
import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';

loadDotenv({ path: '.env.local' });
loadDotenv({ path: '.env' });

// Deliberately not `env('DATABASE_URL')` from prisma/config: it throws at
// config load when unset, which would break `prisma generate`/`validate`
// (backend build/typecheck/test and CI) in environments with no database.
// Migrate commands that actually need the URL fail with Prisma's own
// "datasource URL required" error when it is missing.
const databaseUrl = process.env.DATABASE_URL || undefined;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
