// Typed startup config (TDD Section 9.4): validate env vars once, fail fast,
// and never fall back to a default secret. Values are never logged here.

export interface YahooConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface BackendConfig {
  port: number;
  webOrigin: string;
  databaseUrl: string | undefined;
  redisUrl: string | undefined;
  uploadDir: string;
  sleeperRateLimitPerMin: number;
  // Optional (post-M1 Yahoo provider, PRD Section 6.4): undefined = Yahoo
  // not configured on this install, so the connect affordance stays disabled.
  yahoo: YahooConfig | undefined;
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

// Yahoo OAuth is all-or-nothing: a partial set is a misconfiguration worth
// failing fast on, while an empty set simply leaves Yahoo disabled. Error
// messages name variables only, never their values (TDD Section 9.4).
function loadYahooConfig(env: NodeJS.ProcessEnv): YahooConfig | undefined {
  const entries: Array<[string, string | undefined]> = [
    ['YAHOO_CLIENT_ID', env.YAHOO_CLIENT_ID || undefined],
    ['YAHOO_CLIENT_SECRET', env.YAHOO_CLIENT_SECRET || undefined],
    ['YAHOO_REDIRECT_URI', env.YAHOO_REDIRECT_URI || undefined],
  ];
  const missing = entries.filter(([, value]) => value === undefined).map(([name]) => name);
  if (missing.length === entries.length) return undefined;
  if (missing.length > 0) {
    throw new Error(
      `Incomplete Yahoo OAuth config: missing ${missing.join(', ')} ` +
        '(set YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, and YAHOO_REDIRECT_URI, or none to disable Yahoo)',
    );
  }
  // Yahoo rejects non-https redirect URIs at app registration, so catch an
  // http/malformed value at startup instead of at consent time.
  let redirectUrl: URL | undefined;
  try {
    redirectUrl = new URL(entries[2][1] as string);
  } catch {
    redirectUrl = undefined;
  }
  if (redirectUrl?.protocol !== 'https:') {
    throw new Error(
      'Invalid YAHOO_REDIRECT_URI: expected an https URL exactly matching the registered Yahoo app',
    );
  }
  return {
    clientId: entries[0][1] as string,
    clientSecret: entries[1][1] as string,
    redirectUri: entries[2][1] as string,
  };
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
    yahoo: loadYahooConfig(env),
    nodeEnv,
  };
}
