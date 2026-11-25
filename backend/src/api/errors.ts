// Typed GraphQL errors (TDD §2.2)
// Use via errors.extensions.code for structured error handling in the UI

import { GraphQLError } from 'graphql';

export enum ErrorCode {
  // Auth errors
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  
  // Provider errors
  SLEEPER_USER_NOT_FOUND = 'SLEEPER_USER_NOT_FOUND',
  SLEEPER_NO_LEAGUES = 'SLEEPER_NO_LEAGUES',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  
  // Rate limiting
  REFRESH_COOLDOWN = 'REFRESH_COOLDOWN',
  
  // Generic errors
  NOT_FOUND = 'NOT_FOUND',
}

export interface ErrorExtensions {
  code: ErrorCode;
  retryAfterSeconds?: number;
}

export function createGraphQLError(
  message: string,
  code: ErrorCode,
  extensions?: Omit<ErrorExtensions, 'code'>,
): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code,
      ...extensions,
    },
  });
}

// Convenience error factories
export const UnauthenticatedError = (message = 'Authentication required'): GraphQLError =>
  createGraphQLError(message, ErrorCode.UNAUTHENTICATED);

export const NotFoundError = (resource: string): GraphQLError =>
  createGraphQLError(`${resource} not found`, ErrorCode.NOT_FOUND);

export const SleeperUserNotFoundError = (username: string): GraphQLError =>
  createGraphQLError(
    `Sleeper user "${username}" not found`,
    ErrorCode.SLEEPER_USER_NOT_FOUND,
  );

export const SleeperNoLeaguesError = (username: string): GraphQLError =>
  createGraphQLError(
    `No current-season NFL leagues found for Sleeper user "${username}"`,
    ErrorCode.SLEEPER_NO_LEAGUES,
  );

export const ProviderUnavailableError = (provider: string): GraphQLError =>
  createGraphQLError(
    `Provider ${provider} is temporarily unavailable`,
    ErrorCode.PROVIDER_UNAVAILABLE,
  );

export const RefreshCooldownError = (retryAfterSeconds: number): GraphQLError =>
  createGraphQLError(
    `Please wait ${retryAfterSeconds} seconds before refreshing again`,
    ErrorCode.REFRESH_COOLDOWN,
    { retryAfterSeconds },
  );
