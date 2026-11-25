// Tests for auth stub

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StubTokenVerifier, createAuthContext } from './auth';
import { UnauthenticatedError } from './errors';
import type { PrismaClient } from '../generated/prisma';

describe('StubTokenVerifier', () => {
  it('should accept non-empty token', async () => {
    const verifier = new StubTokenVerifier();
    const uid = await verifier.verifyToken('test-uid-123');
    expect(uid).toBe('test-uid-123');
  });

  it('should reject empty token', async () => {
    const verifier = new StubTokenVerifier();
    await expect(verifier.verifyToken('')).rejects.toThrow('Missing or empty token');
  });

  it('should reject whitespace-only token', async () => {
    const verifier = new StubTokenVerifier();
    await expect(verifier.verifyToken('   ')).rejects.toThrow('Missing or empty token');
  });
});

describe('createAuthContext', () => {
  let mockPrisma: PrismaClient;
  let verifier: StubTokenVerifier;

  beforeEach(() => {
    verifier = new StubTokenVerifier();
    mockPrisma = {
      user: {
        upsert: vi.fn().mockResolvedValue({
          id: 'user-123',
          firebaseUid: 'test-uid',
          email: 'test-uid@stub.local',
          displayName: 'User test-uid',
          authProvider: 'firebase',
        }),
      },
    } as unknown as PrismaClient;
  });

  it('should return null context when no auth header', async () => {
    const ctx = await createAuthContext(undefined, verifier, mockPrisma);
    expect(ctx.userId).toBeNull();
    expect(ctx.firebaseUid).toBeNull();
  });

  it('should reject malformed auth header', async () => {
    await expect(
      createAuthContext('InvalidHeader', verifier, mockPrisma),
    ).rejects.toThrow('Invalid Authorization header format');
  });

  it('should reject non-Bearer auth header', async () => {
    await expect(
      createAuthContext('Basic user:pass', verifier, mockPrisma),
    ).rejects.toThrow('Invalid Authorization header format');
  });

  it('should verify token and upsert user', async () => {
    const ctx = await createAuthContext('Bearer test-uid', verifier, mockPrisma);
    
    expect(ctx.userId).toBe('user-123');
    expect(ctx.firebaseUid).toBe('test-uid');
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
      where: { firebaseUid: 'test-uid' },
      create: expect.objectContaining({
        firebaseUid: 'test-uid',
        authProvider: 'firebase',
      }),
      update: expect.any(Object),
    });
  });
});
