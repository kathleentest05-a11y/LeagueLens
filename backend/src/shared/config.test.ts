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
});
