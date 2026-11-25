// Tests for typed GraphQL errors

import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  createGraphQLError,
  UnauthenticatedError,
  NotFoundError,
  SleeperUserNotFoundError,
  SleeperNoLeaguesError,
  ProviderUnavailableError,
  RefreshCooldownError,
} from './errors';

describe('GraphQL Errors', () => {
  it('should create error with code extension', () => {
    const error = createGraphQLError('Test message', ErrorCode.NOT_FOUND);
    expect(error.message).toBe('Test message');
    expect(error.extensions.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('should create error with additional extensions', () => {
    const error = createGraphQLError('Test message', ErrorCode.REFRESH_COOLDOWN, {
      retryAfterSeconds: 300,
    });
    expect(error.extensions.code).toBe(ErrorCode.REFRESH_COOLDOWN);
    expect(error.extensions.retryAfterSeconds).toBe(300);
  });

  it('should create unauthenticated error', () => {
    const error = UnauthenticatedError();
    expect(error.message).toBe('Authentication required');
    expect(error.extensions.code).toBe(ErrorCode.UNAUTHENTICATED);
  });

  it('should create not found error', () => {
    const error = NotFoundError('Team');
    expect(error.message).toBe('Team not found');
    expect(error.extensions.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('should create Sleeper user not found error', () => {
    const error = SleeperUserNotFoundError('testuser');
    expect(error.message).toContain('testuser');
    expect(error.extensions.code).toBe(ErrorCode.SLEEPER_USER_NOT_FOUND);
  });

  it('should create Sleeper no leagues error', () => {
    const error = SleeperNoLeaguesError('testuser');
    expect(error.message).toContain('testuser');
    expect(error.extensions.code).toBe(ErrorCode.SLEEPER_NO_LEAGUES);
  });

  it('should create provider unavailable error', () => {
    const error = ProviderUnavailableError('Sleeper');
    expect(error.message).toContain('Sleeper');
    expect(error.extensions.code).toBe(ErrorCode.PROVIDER_UNAVAILABLE);
  });

  it('should create refresh cooldown error with retry after', () => {
    const error = RefreshCooldownError(180);
    expect(error.message).toContain('180');
    expect(error.extensions.code).toBe(ErrorCode.REFRESH_COOLDOWN);
    expect(error.extensions.retryAfterSeconds).toBe(180);
  });
});
