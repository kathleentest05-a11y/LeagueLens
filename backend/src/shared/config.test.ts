import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('applies local defaults', () => {
    const config = loadConfig({});
    expect(config.port).toBe(4000);
    expect(config.sleeperRateLimitPerMin).toBe(700);
    expect(config.webOrigin).toBe('http://localhost:3000');
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/Invalid PORT/);
  });

  it('requires DATABASE_URL in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
  });

  it('leaves Yahoo disabled when no Yahoo vars are set', () => {
    expect(loadConfig({}).yahoo).toBeUndefined();
    expect(loadConfig({ YAHOO_CLIENT_ID: '', YAHOO_CLIENT_SECRET: '' }).yahoo).toBeUndefined();
  });

  it('loads Yahoo OAuth config when the full set is present', () => {
    const config = loadConfig({
      YAHOO_CLIENT_ID: 'client-id',
      YAHOO_CLIENT_SECRET: 'client-secret',
      YAHOO_REDIRECT_URI: 'https://localhost:4000/auth/yahoo/callback',
    });
    expect(config.yahoo).toEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://localhost:4000/auth/yahoo/callback',
    });
  });

  it('rejects a non-https YAHOO_REDIRECT_URI (Yahoo requires https redirects)', () => {
    const base = { YAHOO_CLIENT_ID: 'client-id', YAHOO_CLIENT_SECRET: 'client-secret' };
    expect(() =>
      loadConfig({ ...base, YAHOO_REDIRECT_URI: 'http://localhost:4000/auth/yahoo/callback' }),
    ).toThrow(/Invalid YAHOO_REDIRECT_URI/);
    expect(() => loadConfig({ ...base, YAHOO_REDIRECT_URI: 'not-a-url' })).toThrow(
      /Invalid YAHOO_REDIRECT_URI/,
    );
  });

  it('rejects a partial Yahoo config by name, without echoing values', () => {
    let message = '';
    try {
      loadConfig({ YAHOO_CLIENT_SECRET: 'do-not-echo-me' });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/YAHOO_CLIENT_ID/);
    expect(message).toMatch(/YAHOO_REDIRECT_URI/);
    expect(message).not.toContain('do-not-echo-me');
  });
});
