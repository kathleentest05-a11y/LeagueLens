// Typed startup config (TDD Section 9.4): validate env vars once, fail fast,
// and never fall back to a default secret. Values are never logged here.

export interface BackendConfig {
  port: number;
  webOrigin: string;
  databaseUrl: string | undefined;
  redisUrl: string | undefined;
  uploadDir: string;
  sleeperRateLimitPerMin: number;
  nodeEnv: string;
}

function parsePositiveInt(raw: string | undefined, name: string, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${name}: expected a positive integer, got "${raw}"`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const databaseUrl = env.DATABASE_URL || undefined;
  if (nodeEnv === 'production' && !databaseUrl) {
    throw new Error('Missing required env var DATABASE_URL (required in production)');
  }
  return {
    port: parsePositiveInt(env.PORT, 'PORT', 4000),
    webOrigin: env.WEB_ORIGIN ?? 'http://localhost:3000',
    databaseUrl,
    redisUrl: env.REDIS_URL || undefined,
    uploadDir: env.UPLOAD_DIR ?? './data/uploads',
    sleeperRateLimitPerMin: parsePositiveInt(
      env.SLEEPER_RATE_LIMIT_PER_MIN,
      'SLEEPER_RATE_LIMIT_PER_MIN',
      700,
    ),
    nodeEnv,
  };
}
