import { describe, expect, it } from 'vitest';

import { baseVerdict } from '../scripts/branch-base-rule';

describe('a branch cut from a stale main', () => {
  it('passes when main has nothing this branch lacks', () => {
    const verdict = baseVerdict(0, 'fix/tap-targets');
    expect(verdict.ok).toBe(true);
    expect(verdict.message).toContain('fix/tap-targets');
  });

  it('refuses when main has moved on, and says by how much', () => {
    const verdict = baseVerdict(3, 'fix/tap-targets');
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toContain('3 commit(s) behind');
    // the failure mode worth naming out loud
    expect(verdict.message).toContain('delete work it never saw');
  });

  it('refuses when the distance cannot be measured at all', () => {
    expect(baseVerdict(Number.NaN).ok).toBe(false);
    expect(baseVerdict(-1).ok).toBe(false);
  });
});
