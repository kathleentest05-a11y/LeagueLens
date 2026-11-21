import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';

// Local env-file loading for host inner-loop dev (TDD Section 9.1): read
// backend/.env.local, then backend/.env, into process.env before
// loadConfig() runs. A variable already set in the real environment
// (Docker Compose, CI, shell) always wins, and .env.local wins over .env.
// Missing files are a no-op, so Docker images (which ship no env files;
// Compose injects real variables) are unaffected. Values are never logged.
export function loadEnvFiles(
  baseDir: string = join(__dirname, '..', '..'),
  target: NodeJS.ProcessEnv = process.env,
): void {
  for (const name of ['.env.local', '.env']) {
    let content: string;
    try {
      content = readFileSync(join(baseDir, name), 'utf-8');
    } catch {
      continue;
    }
    for (const [key, value] of Object.entries(parse(content))) {
      if (target[key] === undefined) {
        target[key] = value;
      }
    }
  }
}
