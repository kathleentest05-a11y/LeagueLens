// Rate limiter stubs (issue #5 scope, stubbed per problem.txt)
// Per-user/per-league rate limits on provider-triggering mutations
// Real token bucket in issue #5

import { RefreshCooldownError } from './errors';

export interface RateLimiter {
  /**
   * Check if an action is allowed
   * @returns true if allowed, false if on cooldown
   */
  checkAllowed(key: string): Promise<boolean>;

  /**
   * Record an action (consume a token/update timestamp)
   */
  recordAction(key: string): Promise<void>;

  /**
   * Get seconds until the action is allowed again
   */
  getRetryAfter(key: string): Promise<number>;
}

/**
 * In-memory rate limiter stub
 * Real implementation (issue #5) will use Redis for multi-instance coordination
 */
export class InMemoryRateLimiter implements RateLimiter {
  private lastAction: Map<string, number> = new Map();
  private cooldownSeconds: Map<string, number> = new Map();

  constructor(
    private readonly defaultCooldownSeconds: number = 300, // 5 minutes default
  ) {}

  async checkAllowed(key: string): Promise<boolean> {
    const lastTime = this.lastAction.get(key);
    if (!lastTime) {
      return true;
    }

    const cooldown = this.cooldownSeconds.get(key) ?? this.defaultCooldownSeconds;
    const elapsed = (Date.now() - lastTime) / 1000;
    return elapsed >= cooldown;
  }

  async recordAction(key: string): Promise<void> {
    this.lastAction.set(key, Date.now());
  }

  async getRetryAfter(key: string): Promise<number> {
    const lastTime = this.lastAction.get(key);
    if (!lastTime) {
      return 0;
    }

    const cooldown = this.cooldownSeconds.get(key) ?? this.defaultCooldownSeconds;
    const elapsed = (Date.now() - lastTime) / 1000;
    const remaining = Math.max(0, Math.ceil(cooldown - elapsed));
    return remaining;
  }

  /**
   * Configure cooldown for a specific key pattern
   * Used to set different cooldowns for different actions
   */
  setCooldown(keyPattern: string, seconds: number): void {
    this.cooldownSeconds.set(keyPattern, seconds);
  }
}

/**
 * Per-league refresh cooldown (5 minutes per TDD)
 */
export class LeagueRefreshLimiter {
  private limiter: RateLimiter;

  constructor(limiter?: RateLimiter) {
    this.limiter = limiter ?? new InMemoryRateLimiter(300); // 5 minutes
  }

  async checkAndRecord(leagueId: string): Promise<void> {
    const key = `league:refresh:${leagueId}`;
    const allowed = await this.limiter.checkAllowed(key);

    if (!allowed) {
      const retryAfter = await this.limiter.getRetryAfter(key);
      throw RefreshCooldownError(retryAfter);
    }

    await this.limiter.recordAction(key);
  }
}

/**
 * Per-user connectSleeper cooldown (3 attempts per 10 minutes per TDD)
 */
export class ConnectSleeperLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly maxAttempts = 3;
  private readonly windowSeconds = 600; // 10 minutes

  async checkAndRecord(userId: string): Promise<void> {
    const key = `user:connect:${userId}`;
    const now = Date.now();
    const windowStart = now - this.windowSeconds * 1000;

    // Get attempts within the window
    const userAttempts = this.attempts.get(key) ?? [];
    const recentAttempts = userAttempts.filter((time) => time > windowStart);

    if (recentAttempts.length >= this.maxAttempts) {
      // Calculate retry after based on the oldest attempt in the window
      const oldestAttempt = Math.min(...recentAttempts);
      const retryAfter = Math.ceil((oldestAttempt + this.windowSeconds * 1000 - now) / 1000);
      throw RefreshCooldownError(retryAfter);
    }

    // Record this attempt
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
  }
}
