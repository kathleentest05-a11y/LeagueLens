import { describe, expect, it } from 'vitest';
import { resolvers } from './resolvers';

describe('scaffold resolvers', () => {
  it('hello greets from LeagueLens', () => {
    expect(resolvers.Query.hello()).toContain('LeagueLens');
  });

  it('health reports ok', () => {
    expect(resolvers.Query.health()).toMatchObject({ status: 'ok', service: 'api' });
  });
});
