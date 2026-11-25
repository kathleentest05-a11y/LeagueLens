# LeagueLens GraphQL API

## Architecture Overview

```
Request Flow:
Client → Express → Apollo Server → Context Factory → Resolver → Database
                        ↓
                   Auth Verification
                   User Scoping
                   Rate Limiting
```

## File Organization

```
backend/src/api/
├── index.ts                 # Express + Apollo Server setup
├── schema.graphql           # Authoritative SDL (TDD TD-3)
├── resolvers.ts             # Domain resolvers (queries + mutations)
├── context.ts               # GraphQL context factory
├── auth.ts                  # Token verification (stub → Firebase Admin)
├── scoping.ts               # User scoping enforcement
├── errors.ts                # Typed error codes
├── rate-limiter.ts          # Cooldown tracking (stub → Redis)
├── sleeper-adapter.ts       # Provider interface (stub → real HTTP)
├── dataloaders.ts           # N+1 prevention (future optimization)
└── *.test.ts                # Unit tests for each module
```

## Key Principles (TDD §2.2)

### 1. Auth on Every Field
Every resolver checks `ctx.userId` and throws `UNAUTHENTICATED` if missing or accessing another user's data.

```typescript
const userId = requireAuth(ctx);  // Throws if null
const resource = await ctx.prisma.resource.findUnique({ where: { id } });
assertOwnership(ctx, resource.userId, 'Resource');  // Throws if different user
```

### 2. No Provider Passthrough
Query resolvers read the normalized database only. The sole exception is `connectSleeper`'s bounded username lookup.

```typescript
// ✅ Allowed: Read from database
const teams = await ctx.prisma.team.findMany({ where: { userId } });

// ❌ Not allowed in queries: Call provider
const leagues = await ctx.sleeperAdapter.listLeagues(...);

// ✅ Exception: Bounded lookup in connectSleeper mutation
const user = await ctx.sleeperAdapter.resolveUser(username);  // Then enqueue, don't fan-out
```

### 3. Typed Errors
Domain failures return structured error codes via `extensions.code`:

```typescript
throw SleeperUserNotFoundError('username');
// Returns: { extensions: { code: 'SLEEPER_USER_NOT_FOUND' } }

throw RefreshCooldownError(180);
// Returns: { extensions: { code: 'REFRESH_COOLDOWN', retryAfterSeconds: 180 } }
```

Error codes: `UNAUTHENTICATED`, `NOT_FOUND`, `SLEEPER_USER_NOT_FOUND`, `SLEEPER_NO_LEAGUES`, `PROVIDER_UNAVAILABLE`, `REFRESH_COOLDOWN`

### 4. Rate Limiting
Mutations that trigger provider work enforce cooldowns:
- `refreshLeague`: 5 minutes per league
- `connectSleeper`: 3 attempts per 10 minutes per user

```typescript
await refreshLimiter.checkAndRecord(leagueId);  // Throws REFRESH_COOLDOWN if too soon
```

## Context Structure

```typescript
interface GraphQLContext {
  userId: string | null;           // Authenticated user ID (scoped to this user)
  firebaseUid: string | null;      // Firebase identity
  prisma: PrismaClient;            // Database client
  sleeperAdapter: SleeperAdapter;  // Provider interface (stub → real)
  leagueRefreshLimiter: RateLimiter;
  connectSleeperLimiter: RateLimiter;
}
```

Created per request by `createGraphQLContext()` which:
1. Extracts `Authorization: Bearer <token>` header
2. Verifies token (stub: treats as firebaseUid; real: Firebase Admin)
3. Upserts `User` record
4. Returns context with `userId` set

## Resolver Patterns

### Query Pattern
```typescript
async queryName(_parent, args, ctx: GraphQLContext) {
  const userId = requireAuth(ctx);  // Enforce auth
  
  const resources = await ctx.prisma.resource.findMany({
    where: { userId },  // Scope to user
  });
  
  return resources;  // Never call provider adapter
}
```

### Mutation Pattern
```typescript
async mutationName(_parent, args, ctx: GraphQLContext) {
  const userId = requireAuth(ctx);  // Enforce auth
  
  await rateLimiter.checkAndRecord(key);  // Enforce cooldown
  
  const resource = await ctx.prisma.resource.findUnique({ where: { id: args.id } });
  assertOwnership(ctx, resource.userId, 'Resource');  // Verify ownership
  
  // Modify resource
  const updated = await ctx.prisma.resource.update({ ... });
  
  // Enqueue provider sync if needed (worker job, not inline)
  
  return updated;
}
```

## Testing Strategy

Each resolver test verifies:
1. **Auth scoping**: Unauthenticated requests rejected
2. **User isolation**: User A cannot access user B's data
3. **Error codes**: Specific codes for each failure case
4. **Provider isolation**: Query resolvers make no provider calls
5. **Rate limiting**: Mutations enforce cooldowns

Example test:
```typescript
it('should reject access to another users team', async () => {
  mockPrisma.team.findUnique.mockResolvedValue({
    league: { connection: { userId: 'other-user' } }
  });
  
  await expect(
    resolvers.Query.team(null, { id: 'team-123' }, ctx)
  ).rejects.toMatchObject({
    extensions: { code: 'UNAUTHENTICATED' }
  });
});
```

## Stubbed vs. Real Implementation

### Current (Stubbed)
- **Auth**: `StubTokenVerifier` treats Bearer token as firebaseUid
- **Sleeper**: `StubSleeperAdapter` returns fixture data
- **Rate Limiting**: `InMemoryRateLimiter` tracks cooldowns in-process

### Future (Issues #4, #5)
- **Auth**: `FirebaseTokenVerifier` uses firebase-admin to verify real tokens
- **Sleeper**: `SleeperAdapter` makes real HTTP calls with token bucket rate limiter
- **Rate Limiting**: `RedisRateLimiter` shares state across multiple API instances

Stubs implement the same interfaces, so integration is a dependency injection change:
```typescript
// Swap in real implementations in index.ts
const tokenVerifier = new FirebaseTokenVerifier(firebaseApp);
const sleeperAdapter = new SleeperAdapter(tokenBucket);
const rateLimiter = new RedisRateLimiter(redisClient);
```

## Performance Optimization (Future)

### DataLoaders
To prevent N+1 queries when resolving nested fields (e.g., team.alerts, roster.player):

1. Add DataLoader to dependencies
2. Create loaders in context factory
3. Replace direct Prisma calls with loader calls

Example:
```typescript
// Before: N+1 (one query per team)
Team.alerts: async (parent, _args, ctx) => {
  return ctx.prisma.alert.findMany({ where: { teamId: parent.id } });
}

// After: Batched (one query for all teams)
Team.alerts: async (parent, _args, ctx) => {
  return ctx.loaders.alertsByTeam.load(parent.id);
}
```

See `dataloaders.ts` for implementation pattern.

## Deployment Notes

- Schema changes require `npm run codegen` to regenerate types
- Context factory runs on every request; keep initialization light
- Rate limiters are in-memory for single-instance; require Redis for multi-instance
- Graceful shutdown disconnects Prisma: `await prisma.$disconnect()`
