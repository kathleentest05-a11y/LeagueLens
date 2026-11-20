// M0 scaffold resolvers. Domain resolvers (dashboard, team, alerts) land
// with M1 per TDD Section 2.1 and must scope every field to the user.
export const resolvers = {
  Query: {
    hello: (): string => 'Hello from the LeagueLens API (M0 scaffold; domain schema lands in M1).',
    health: () => ({
      status: 'ok',
      service: 'api',
      version: '0.1.0',
    }),
  },
};
