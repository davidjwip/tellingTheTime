/**
 * Test-first gate (binary).
 *
 * Runs unconditionally on import. The first version guarded the entry point with
 * `process.argv[1]?.includes('check-test-first')`; under vite-node argv[1] is the vite-node binary,
 * so main() never ran and the gate passed every history by doing nothing. The rule lives in
 * test-first-rule.ts where a test can import it, and this file has no entry-point condition.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { assertRuleWorks, auditBaselineMove, findViolations, parseNameStatus } from './test-first-rule';

import type { Commit, Violation } from './test-first-rule';

const BASELINE_FILE = 'tests-first.baseline';

function git(args: string[]): string {
  // stderr is piped away: `git show origin/main:file` failing is an expected probe, not noise
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function readCommits(from: string): Commit[] {
  const shas = git(['rev-list', '--reverse', `${from}..HEAD`]).split('\n').filter(Boolean);

  return shas.map((sha) => ({
    sha: sha.slice(0, 7),
    subject: git(['show', '-s', '--format=%s', sha]).trim(),
    files: parseNameStatus(git(['show', '--pretty=format:', '--name-status', sha])),
  }));
}

function readBaselineOnMain(): string | null {
  try {
    return git(['show', `origin/main:${BASELINE_FILE}`]).trim();
  } catch {
    return null; // fresh clone or offline: cannot verify, and the run says so
  }
}

function main(): void {
  assertRuleWorks();

  if (!existsSync(BASELINE_FILE)) {
    console.error(`no ${BASELINE_FILE}: refusing to guess where the rule starts`);
    process.exit(1);
  }

  const branchBaseline = readFileSync(BASELINE_FILE, 'utf8').trim();
  const onMain = readBaselineOnMain();
  const from = onMain ?? branchBaseline;

  let commits: Commit[];
  try {
    commits = readCommits(from);
  } catch {
    console.error(`cannot read ${from}..HEAD - is it an ancestor? (CI needs fetch-depth: 0)`);
    process.exit(1);
  }

  if (onMain === null) {
    console.log('test-first: origin/main unavailable, baseline move not verified');
  } else if (branchBaseline !== onMain) {
    const problem = auditBaselineMove(commits, onMain, branchBaseline);
    if (problem) {
      console.error(`test-first gate failed:\n\n  ${problem}`);
      process.exit(1);
    }
    console.log(`test-first: baseline advanced ${onMain.slice(0, 7)} -> ${branchBaseline.slice(0, 7)}`);
  }

  const violations: Violation[] = findViolations(commits);
  if (violations.length === 0) {
    console.log(`test-first: ${commits.length} commit(s) since ${from.slice(0, 7)}, no violations`);
    return;
  }

  console.error('test-first gate failed:\n');
  for (const v of violations) {
    console.error(`  ${v.sha}  ${v.path}\n        ${v.why}\n        in: ${v.subject}`);
  }
  console.error('\nWrite the failing test in its own commit first, then make it pass.');
  process.exit(1);
}

main();
