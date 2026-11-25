// User scoping helpers (TDD §2.2)
// Every resolver must scope to ctx.userId; no resolver returns another user's data

import type { GraphQLContext } from './context';
import { UnauthenticatedError } from './errors';

/**
 * Require authentication and return the userId
 * Throws UNAUTHENTICATED if not authenticated
 */
export function requireAuth(ctx: GraphQLContext): string {
  if (!ctx.userId) {
    throw UnauthenticatedError();
  }
  return ctx.userId;
}

/**
 * Check if a resource belongs to the authenticated user
 * Used for additional scoping checks after DB queries
 */
export function assertOwnership(
  ctx: GraphQLContext,
  resourceUserId: string,
  resourceName: string,
): void {
  const userId = requireAuth(ctx);
  if (resourceUserId !== userId) {
    throw UnauthenticatedError(`Access denied: ${resourceName} belongs to another user`);
  }
}
