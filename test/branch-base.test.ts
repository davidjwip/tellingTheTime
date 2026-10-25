import { describe, expect, it } from 'vitest';

import { SKIP_ENV, baseVerdict, measureBehind, skipRequested } from '../scripts/branch-base-rule';

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

  it('refuses when the distance cannot be measured, and says how to proceed deliberately', () => {
    const verdict = baseVerdict(Number.NaN);
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toContain('could not measure');
    expect(verdict.message).toContain(`${SKIP_ENV}=1`);
    expect(baseVerdict(-1).ok).toBe(false);
  });

  it('reads the count from git, and reports "unmeasurable" instead of throwing', () => {
    expect(measureBehind(() => '3\n')).toBe(3);
    expect(measureBehind(() => ' 0 ')).toBe(0);
    expect(
      measureBehind(() => {
        throw new Error('fatal: ambiguous argument');
      }),
    ).toBeUndefined();
    expect(measureBehind(() => 'not a number')).toBeUndefined();
  });

  it('can be bypassed on purpose, by one named variable', () => {
    expect(skipRequested('1')).toBe(true);
    expect(skipRequested(undefined)).toBe(false);
    expect(skipRequested('0')).toBe(false);
    expect(SKIP_ENV).toBe('SKIP_BRANCH_BASE');
  });
});
