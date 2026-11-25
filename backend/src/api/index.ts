import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import express from 'express';
import { loadConfig } from '../shared/config';
import { loadEnvFiles } from '../shared/env';
import { getPrismaClient } from '../shared/db';
import { resolvers } from './resolvers';
import { createGraphQLContext, type ContextFactoryDeps } from './context';
import { StubTokenVerifier } from './auth';
import { StubSleeperAdapter } from './sleeper-adapter';
import { InMemoryRateLimiter } from './rate-limiter';

async function main(): Promise<void> {
  loadEnvFiles();
  const config = loadConfig();
  const typeDefs = readFileSync(join(__dirname, 'schema.graphql'), 'utf-8');

  // Initialize dependencies
  const prisma = getPrismaClient();
  const tokenVerifier = new StubTokenVerifier();
  const sleeperAdapter = new StubSleeperAdapter();
  const leagueRefreshLimiter = new InMemoryRateLimiter(300); // 5 minutes
  const connectSleeperLimiter = new InMemoryRateLimiter(600); // 10 minutes

  const contextDeps: ContextFactoryDeps = {
    prisma,
    tokenVerifier,
    sleeperAdapter,
    leagueRefreshLimiter,
    connectSleeperLimiter,
  };

  const app = express();
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/readyz', (_req, res) => {
    res.json({ status: 'ready' });
  });

  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });
  await server.start();
  app.use(
    '/graphql',
    cors({ origin: config.webOrigin }),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => createGraphQLContext(req, contextDeps),
    }),
  );

  const httpServer = app.listen(config.port, () => {
    console.log(`LeagueLens API listening on http://localhost:${config.port}/graphql`);
  });

  const shutdown = async () => {
    await server.stop();
    await prisma.$disconnect();
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error: unknown) => {
  console.error('API failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
