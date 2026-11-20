// Shared types/constants only (TDD 11.2): no DB access, no secrets, no server-only code.
export * from './generated/graphql';

export const Sport = {
  NFL: 'nfl',
  NBA: 'nba',
} as const;
export type Sport = (typeof Sport)[keyof typeof Sport];

export const AlertType = {
  INJURED_STARTER: 'injured_starter',
  BYE_WEEK_STARTER: 'bye_week_starter',
  EMPTY_STARTER_SLOT: 'empty_starter_slot',
  LINEUP_LOCK_APPROACHING: 'lineup_lock_approaching',
  QUESTIONABLE_STARTER: 'questionable_starter',
  SYNC_STALE: 'sync_stale',
} as const;
export type AlertType = (typeof AlertType)[keyof typeof AlertType];

export const AlertSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];
