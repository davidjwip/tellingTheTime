import { describe, expect, it } from 'vitest';

import { assertRuleWorks, findViolations, moduleOf, parseNameStatus } from '../scripts/test-first-rule';

import type { Commit } from '../scripts/test-first-rule';

const commit = (sha: string, files: Array<[string, string]>): Commit => ({
  sha,
  subject: `commit ${sha}`,
  files: files.map(([status, path]) => ({ status, path })),
});

describe('the test-first rule', () => {
  it('passes when the test lands in an earlier commit than the module', () => {
    expect(
      findViolations([
        commit('a1', [['A', 'test/engine.test.ts']]),
        commit('a2', [['A', 'src/engine.ts']]),
      ]),
    ).toEqual([]);
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

  it('allows a change to a module that is already tested, without forcing test churn', () => {
    // started stricter - every src change must touch its test - and that is worse: it buys empty
    // assertions for comment fixes. The load-bearing rule is that a NEW module arrives tested.
    expect(
      findViolations([
        commit('e1', [['A', 'test/engine.test.ts']]),
        commit('e2', [['A', 'src/engine.ts']]),
        commit('e3', [['M', 'src/engine.ts']]),
      ]),
    ).toEqual([]);
  });

  it('still fails a change to a module that was never tested at all', () => {
    const violations = findViolations([
      commit('h1', [['A', 'src/engine.ts']]),
      commit('h2', [['M', 'src/engine.ts']]),
    ]);
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

describe('modules already tested before the branch', () => {
  it('allows a change to a module whose test exists on the base branch', () => {
    const commits = [commit('n1', [['M', 'src/play.ts']])];
    // without the seed this is a violation; with it, play.ts is already covered by play.test.ts
    expect(findViolations(commits, ['play'])).toEqual([]);
    expect(findViolations(commits)).toHaveLength(1);
  });

  it('still refuses a NEW module with no test anywhere', () => {
    const commits = [commit('n2', [['A', 'src/shell.ts']])];
    expect(findViolations(commits, ['play'])).toHaveLength(1);
  });
});

describe('reading git output', () => {
  it('takes the new path from a rename, and treats it as an addition', () => {
    // R100<TAB>old<TAB>new - reading column 2 reports the OLD name, so a module could arrive
    // untested simply by being renamed into place
    expect(parseNameStatus('R100\tsrc/types.ts\tsrc/engine.ts')).toEqual([
      { status: 'A', path: 'src/engine.ts' },
    ]);
  });

  it('treats a copied file as an addition too', () => {
    expect(parseNameStatus('C075\tsrc/a.ts\tsrc/b.ts')).toEqual([{ status: 'A', path: 'src/b.ts' }]);
  });

  it('reads ordinary additions, modifications and deletions', () => {
    expect(parseNameStatus('A\tsrc/x.ts\nM\tsrc/y.ts\nD\tsrc/z.ts')).toEqual([
      { status: 'A', path: 'src/x.ts' },
      { status: 'M', path: 'src/y.ts' },
      { status: 'D', path: 'src/z.ts' },
    ]);
  });

  it('ignores blank lines, which git emits around commit headers', () => {
    expect(parseNameStatus('\n\nA\tsrc/x.ts\n\n')).toEqual([{ status: 'A', path: 'src/x.ts' }]);
  });
});

describe('the gate proves it can fail', () => {
  it('flags a planted same-commit violation and clears a planted correct pair', () => {
    // the previous gate could not fail, because it never ran at all
    expect(() => assertRuleWorks()).not.toThrow();
  });
});