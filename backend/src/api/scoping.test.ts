// Tests for user scoping enforcement

import { describe, it, expect } from 'vitest';
import { requireAuth, assertOwnership } from './scoping';
import { ErrorCode } from './errors';
import type { GraphQLContext } from './context';

describe('requireAuth', () => {
  it('should return userId when authenticated', () => {
    const ctx = { userId: 'user-123' } as GraphQLContext;
    const userId = requireAuth(ctx);
    expect(userId).toBe('user-123');
  });

  it('should throw UNAUTHENTICATED when not authenticated', () => {
    const ctx = { userId: null } as GraphQLContext;
    expect(() => requireAuth(ctx)).toThrowError(
      expect.objectContaining({
        extensions: expect.objectContaining({
          code: ErrorCode.UNAUTHENTICATED,
        }),
      }),
    );
  });
});

describe('assertOwnership', () => {
  it('should pass when resource belongs to user', () => {
    const ctx = { userId: 'user-123' } as GraphQLContext;
    expect(() => assertOwnership(ctx, 'user-123', 'Team')).not.toThrow();
  });

  it('should throw when resource belongs to different user', () => {
    const ctx = { userId: 'user-123' } as GraphQLContext;
    expect(() => assertOwnership(ctx, 'user-456', 'Team')).toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Access denied'),
        extensions: expect.objectContaining({
          code: ErrorCode.UNAUTHENTICATED,
        }),
      }),
    );
  });

  it('should throw when not authenticated', () => {
    const ctx = { userId: null } as GraphQLContext;
    expect(() => assertOwnership(ctx, 'user-123', 'Team')).toThrowError(
      expect.objectContaining({
        extensions: expect.objectContaining({
          code: ErrorCode.UNAUTHENTICATED,
        }),
      }),
    );
  });
});
