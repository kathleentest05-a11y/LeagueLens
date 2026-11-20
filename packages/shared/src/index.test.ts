import { describe, expect, it } from 'vitest';
import { AlertSeverity, AlertType, Sport } from './index';

describe('shared constants', () => {
  it('exposes the MVP sports', () => {
    expect(Object.values(Sport)).toEqual(['nfl', 'nba']);
  });

  it('exposes the PRD Section 9 alert types and severities', () => {
    expect(Object.values(AlertType)).toContain('injured_starter');
    expect(Object.values(AlertType)).toContain('lineup_lock_approaching');
    expect(Object.values(AlertSeverity)).toEqual(['low', 'medium', 'high', 'critical']);
  });
});
