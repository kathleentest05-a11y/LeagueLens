import { afterEach, describe, expect, it } from 'vitest';
import { createDb } from './db';

// Prisma 7 client construction (no live database): the URL now comes from
// the validated config through the pg driver adapter instead of the schema
// `url` / `datasourceUrl`. Construction is lazy — a client made with an
// explicit URL must not connect (or fail) until a query runs.
describe('createDb', () => {
  const savedDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (savedDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = savedDatabaseUrl;
    }
  });

  it('constructs a client from an explicit URL without connecting', async () => {
    const db = createDb('postgres://nobody:nopassword@localhost:5432/none');
    expect(db.user).toBeDefined();
    await expect(db.$disconnect()).resolves.toBeUndefined();
  });

  it('throws when no DATABASE_URL is available', () => {
    delete process.env.DATABASE_URL;
    expect(() => createDb()).toThrow(/Missing DATABASE_URL/);
  });

  it('falls back to DATABASE_URL from the environment', async () => {
    process.env.DATABASE_URL = 'postgres://nobody:nopassword@localhost:5432/none';
    const db = createDb();
    expect(db.user).toBeDefined();
    await db.$disconnect();
  });
});
