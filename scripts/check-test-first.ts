/**
 * Test-first gate (binary).
 *
 * Runs unconditionally on import. The first version guarded the entry point with
 * `process.argv[1]?.includes('check-test-first')`; under vite-node argv[1] is the vite-node binary,
 * so main() never ran and the gate passed every history by doing nothing. The rule now lives in
 * test-first-rule.ts where a test can import it, and this file has no entry-point condition at all.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { assertRuleWorks, findViolations, parseNameStatus } from './test-first-rule';

import type { Commit, Violation } from './test-first-rule';

const BASELINE_FILE = 'tests-first.baseline';

function git(args: string[]): string {
  // stderr is piped away: `git show origin/main:file` failing is an expected probe, not noise
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function readCommits(baseline: string): Commit[] {
  const shas = git(['rev-list', '--reverse', `${baseline}..HEAD`])
    .split('\n')
    .filter(Boolean);

  return shas.map((sha) => ({
    sha: sha.slice(0, 7),
    subject: git(['show', '-s', '--format=%s', sha]).trim(),
    files: parseNameStatus(git(['show', '--pretty=format:', '--name-status', sha])),
  }));
}

/**
 * The baseline decides where the rule starts, so moving it is how you get out of the rule. On a
 * branch it may not differ from the copy on main; only a commit on main may advance it.
 */
function checkBaselineUnmoved(baseline: string): string | null {
  let onMain: string;
  try {
    onMain = git(['show', `origin/main:${BASELINE_FILE}`]).trim();
  } catch {
    return null; // no origin/main locally (fresh clone, offline) — cannot verify
  }
  if (onMain !== baseline) {
    return `baseline moved on this branch: main has ${onMain}, this branch has ${baseline}. ` +
      'Only a commit on main may advance the baseline — otherwise anyone edits one line and is exempt.';
  }
  return null;
}

function main(): void {
  assertRuleWorks();

  if (!existsSync(BASELINE_FILE)) {
    console.error(`no ${BASELINE_FILE}: refusing to guess where the rule starts`);
    process.exit(1);
  }

  const baseline = readFileSync(BASELINE_FILE, 'utf8').trim();

  const moved = checkBaselineUnmoved(baseline);
  if (moved) {
    console.error(`test-first gate failed:\n\n  ${moved}`);
    process.exit(1);
  }

  let commits: Commit[];
  try {
    commits = readCommits(baseline);
  } catch {
    console.error(`cannot read ${baseline}..HEAD — is ${baseline} an ancestor? (CI needs fetch-depth: 0)`);
    process.exit(1);
  }

  const violations: Violation[] = findViolations(commits);
  if (violations.length === 0) {
    console.log(`test-first: ${commits.length} commit(s) since ${baseline.slice(0, 7)}, no violations`);
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
