import { describe, expect, it } from 'vitest';

import { findViolations, moduleOf } from '../scripts/check-test-first';

import type { Commit } from '../scripts/check-test-first';

const commit = (sha: string, files: Array<[string, string]>): Commit => ({
  sha,
  subject: `commit ${sha}`,
  files: files.map(([status, path]) => ({ status, path })),
});

describe('the test-first rule', () => {
  it('passes when the test lands in an earlier commit than the module', () => {
    const violations = findViolations([
      commit('a1', [['A', 'test/engine.test.ts']]),
      commit('a2', [['A', 'src/engine.ts']]),
    ]);
    expect(violations).toEqual([]);
  });

  it('fails when a module is added with its test in the same commit', () => {
    const violations = findViolations([
      commit('b1', [
        ['A', 'src/engine.ts'],
        ['A', 'test/engine.test.ts'],
      ]),
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.why).toContain('must come first');
  });

  it('fails when a module is added with no test at all', () => {
    const violations = findViolations([commit('c1', [['A', 'src/play.ts']])]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.why).toContain('no test');
  });

  it('allows a change to a tested module when the test changes in the same commit', () => {
    const violations = findViolations([
      commit('d1', [['A', 'test/engine.test.ts']]),
      commit('d2', [['A', 'src/engine.ts']]),
      commit('d3', [
        ['M', 'src/engine.ts'],
        ['M', 'test/engine.test.ts'],
      ]),
    ]);
    expect(violations).toEqual([]);
  });

  it('allows a change to a module that is already tested, without forcing test churn', () => {
    // This started as the stricter rule — every src change must touch its test — and that is worse:
    // it buys empty assertions for comment fixes and renames. The load-bearing rule is that a NEW
    // module arrives tested, which is the shape the last two increments actually got wrong.
    const violations = findViolations([
      commit('e1', [['A', 'test/engine.test.ts']]),
      commit('e2', [['A', 'src/engine.ts']]),
      commit('e3', [['M', 'src/engine.ts']]),
    ]);
    expect(violations).toEqual([]);
  });

  it('still fails a change to a module that was never tested at all', () => {
    const violations = findViolations([
      commit('h1', [['A', 'src/engine.ts']]),
      commit('h2', [['M', 'src/engine.ts']]),
    ]);
    // both commits are violations: the module arrived untested and stays untested
    expect(violations).toHaveLength(2);
  });

  it('does not let a test added later retroactively excuse an earlier module', () => {
    const violations = findViolations([
      commit('f1', [['A', 'src/engine.ts']]),
      commit('f2', [['A', 'test/engine.test.ts']]),
    ]);
    expect(violations).toHaveLength(1);
  });

  it('exempts the type-only and bootstrap modules, and nothing else', () => {
    const violations = findViolations([
      commit('g1', [
        ['A', 'src/types.ts'],
        ['A', 'src/main.ts'],
        ['A', 'src/engine.ts'],
      ]),
    ]);
    expect(violations.map((v) => v.path)).toEqual(['src/engine.ts']);
  });

  it('reads the module name out of src and test paths', () => {
    expect(moduleOf('src/clockFace.ts')).toBe('clockFace');
    expect(moduleOf('test/clockFace.test.ts')).toBe('clockFace');
  });
});
