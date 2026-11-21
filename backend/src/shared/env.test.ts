import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadEnvFiles } from './env';

describe('loadEnvFiles', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'leaguelens-env-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads values from .env.local (the README inner-loop file)', () => {
    writeFileSync(join(dir, '.env.local'), 'PORT=4011\nWEB_ORIGIN=http://localhost:3000\n');
    const env: NodeJS.ProcessEnv = {};
    loadEnvFiles(dir, env);
    expect(env.PORT).toBe('4011');
    expect(env.WEB_ORIGIN).toBe('http://localhost:3000');
  });

  it('never overrides a real environment variable (Compose/CI wins over files)', () => {
    writeFileSync(join(dir, '.env.local'), 'PORT=4011\n');
    const env: NodeJS.ProcessEnv = { PORT: '4000' };
    loadEnvFiles(dir, env);
    expect(env.PORT).toBe('4000');
  });

  it('prefers .env.local over .env, and still reads keys only in .env', () => {
    writeFileSync(join(dir, '.env.local'), 'PORT=4011\n');
    writeFileSync(join(dir, '.env'), 'PORT=4000\nUPLOAD_DIR=./data/uploads\n');
    const env: NodeJS.ProcessEnv = {};
    loadEnvFiles(dir, env);
    expect(env.PORT).toBe('4011');
    expect(env.UPLOAD_DIR).toBe('./data/uploads');
  });

  it('is a no-op when neither file exists (Docker images ship no env files)', () => {
    const env: NodeJS.ProcessEnv = { PORT: '4000' };
    expect(() => loadEnvFiles(dir, env)).not.toThrow();
    expect(env).toEqual({ PORT: '4000' });
  });
});
