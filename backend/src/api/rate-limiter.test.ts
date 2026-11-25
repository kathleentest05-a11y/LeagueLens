// Tests for rate limiter stubs

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InMemoryRateLimiter,
  LeagueRefreshLimiter,
  ConnectSleeperLimiter,
} from './rate-limiter';
import { ErrorCode } from './errors';

describe('InMemoryRateLimiter', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter(2); // 2 second cooldown for fast tests
  });

  it('should allow first action', async () => {
    const allowed = await limiter.checkAllowed('test-key');
    expect(allowed).toBe(true);
  });

  it('should block action within cooldown', async () => {
    await limiter.recordAction('test-key');
    const allowed = await limiter.checkAllowed('test-key');
    expect(allowed).toBe(false);
  });

  it('should allow action after cooldown', async () => {
    await limiter.recordAction('test-key');
    
    // Wait for cooldown
    await new Promise((resolve) => setTimeout(resolve, 2100));
    
    const allowed = await limiter.checkAllowed('test-key');
    expect(allowed).toBe(true);
  });

  it('should return correct retry after seconds', async () => {
    await limiter.recordAction('test-key');
    const retryAfter = await limiter.getRetryAfter('test-key');
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(2);
  });

  it('should return zero retry after when no action recorded', async () => {
    const retryAfter = await limiter.getRetryAfter('unknown-key');
    expect(retryAfter).toBe(0);
  });

  it('should handle different keys independently', async () => {
    await limiter.recordAction('key-1');
    const allowed1 = await limiter.checkAllowed('key-1');
    const allowed2 = await limiter.checkAllowed('key-2');
    
    expect(allowed1).toBe(false);
    expect(allowed2).toBe(true);
  });
});

describe('LeagueRefreshLimiter', () => {
  it('should enforce 5-minute cooldown', async () => {
    const mockLimiter = {
      checkAllowed: vi.fn().mockResolvedValue(true),
      recordAction: vi.fn().mockResolvedValue(undefined),
      getRetryAfter: vi.fn().mockResolvedValue(0),
    };

    const refreshLimiter = new LeagueRefreshLimiter(mockLimiter);
    await refreshLimiter.checkAndRecord('league-123');

    expect(mockLimiter.checkAllowed).toHaveBeenCalledWith('league:refresh:league-123');
    expect(mockLimiter.recordAction).toHaveBeenCalledWith('league:refresh:league-123');
  });

  it('should throw REFRESH_COOLDOWN when blocked', async () => {
    const mockLimiter = {
      checkAllowed: vi.fn().mockResolvedValue(false),
      recordAction: vi.fn(),
      getRetryAfter: vi.fn().mockResolvedValue(180),
    };

    const refreshLimiter = new LeagueRefreshLimiter(mockLimiter);
    
    await expect(refreshLimiter.checkAndRecord('league-123')).rejects.toMatchObject({
      extensions: {
        code: ErrorCode.REFRESH_COOLDOWN,
        retryAfterSeconds: 180,
      },
    });
    
    expect(mockLimiter.recordAction).not.toHaveBeenCalled();
  });
});

describe('ConnectSleeperLimiter', () => {
  let limiter: ConnectSleeperLimiter;

  beforeEach(() => {
    limiter = new ConnectSleeperLimiter();
  });

  it('should allow first 3 attempts', async () => {
    await limiter.checkAndRecord('user-1');
    await limiter.checkAndRecord('user-1');
    await limiter.checkAndRecord('user-1');
    // All should succeed
  });

  it('should block 4th attempt within window', async () => {
    await limiter.checkAndRecord('user-1');
    await limiter.checkAndRecord('user-1');
    await limiter.checkAndRecord('user-1');
    
    await expect(limiter.checkAndRecord('user-1')).rejects.toMatchObject({
      extensions: {
        code: ErrorCode.REFRESH_COOLDOWN,
      },
    });
  });

  it('should handle different users independently', async () => {
    await limiter.checkAndRecord('user-1');
    await limiter.checkAndRecord('user-1');
    await limiter.checkAndRecord('user-1');
    
    // Different user should still be allowed
    await limiter.checkAndRecord('user-2');
  });
});
