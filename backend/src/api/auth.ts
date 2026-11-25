// Auth stub (issue #4 scope, stubbed per problem.txt)
// Treats Authorization: Bearer <value> as the firebaseUid
// No firebase-admin or emulator in this task

import type { PrismaClient } from '../generated/prisma';
import { UnauthenticatedError } from './errors';

export interface TokenVerifier {
  /**
   * Verify an ID token and return the Firebase UID.
   * Throws UnauthenticatedError if verification fails.
   */
  verifyToken(token: string): Promise<string>;
}

/**
 * Stub TokenVerifier that treats the token value as the firebaseUid directly.
 * Real implementation (issue #4) will use firebase-admin.
 */
export class StubTokenVerifier implements TokenVerifier {
  async verifyToken(token: string): Promise<string> {
    if (!token || token.trim() === '') {
      throw UnauthenticatedError('Missing or empty token');
    }
    // In the stub, the token IS the firebaseUid
    return token;
  }
}

export interface AuthContext {
  userId: string | null;
  firebaseUid: string | null;
}

/**
 * Extract and verify the Authorization header, upsert the User, and return the context.
 * Missing/invalid header → UNAUTHENTICATED error.
 */
export async function createAuthContext(
  authHeader: string | undefined,
  verifier: TokenVerifier,
  prisma: PrismaClient,
): Promise<AuthContext> {
  // No auth header = not authenticated
  if (!authHeader) {
    return { userId: null, firebaseUid: null };
  }

  // Parse "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw UnauthenticatedError('Invalid Authorization header format');
  }

  const token = parts[1];
  const firebaseUid = await verifier.verifyToken(token);

  // Upsert user on first authenticated request
  const user = await prisma.user.upsert({
    where: { firebaseUid },
    create: {
      firebaseUid,
      email: `${firebaseUid}@stub.local`, // Stub email; real auth will get from Firebase
      displayName: `User ${firebaseUid}`,
      authProvider: 'firebase',
    },
    update: {
      // On subsequent requests, just update the timestamp
      updatedAt: new Date(),
    },
  });

  return {
    userId: user.id,
    firebaseUid,
  };
}
