/**
 * Test-first gate (binary).
 *
 * Runs unconditionally on import. The first version guarded the entry point with
 * `process.argv[1]?.includes('check-test-first')`; under vite-node argv[1] is the vite-node binary,
 * so main() never ran and the gate passed every history by doing nothing. The rule lives in
 * test-first-rule.ts where a test can import it, and this file has no entry-point condition.
 */

import { execFileSync } from 'node:child_process';

import { assertRuleWorks, findViolations, parseNameStatus } from './test-first-rule';

import type { Commit, Violation } from './test-first-rule';

function git(args: string[]): string {
  // stderr is piped away: `git show origin/main:file` failing is an expected probe, not noise
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function readCommits(from: string): Commit[] {
  const shas = git(['rev-list', '--reverse', `${from}..HEAD`]).split('\n').filter(Boolean);

  return shas.map((sha) => {
    // --first-parent -m makes a MERGE show the changes it brings onto the branch. A plain
    // `git show --name-status` on a merge prints nothing, so a module merged in from a side branch
    // would arrive invisible to the gate.
    const files = parseNameStatus(
      git(['show', '--pretty=format:', '--name-status', '--first-parent', '-m', sha]),
    );

    // a merge can list a path once per parent; the rule only cares that it changed
    const unique = [...new Map(files.map((file) => [file.path, file])).values()];

    return {
      sha: sha.slice(0, 7),
      subject: git(['show', '-s', '--format=%s', sha]).trim(),
      files: unique,
    };
  });
}

/**
 * Where the rule starts: the point where this branch left main.
 *
 * The first version pinned a commit SHA in a file. That was unsound — a merge rewrites SHAs, so the
 * pin went stale the first time a PR was merged, and the range it produced silently included
 * commits that predated the rule. A merge base cannot go stale, cannot be edited, and cannot be
 * moved without rewriting main, which is exactly the property a start line needs.
 */
function mergeBase(): string {
  const base = git(['merge-base', 'origin/main', 'HEAD']).trim();
  if (base.length === 0) throw new Error('empty merge base');
  return base;
}

function main(): void {
  assertRuleWorks();

  let from: string;
  let commits: Commit[];
  let seeded: string[] = [];
  try {
    from = mergeBase();
    commits = readCommits(from);
    seeded = git(['ls-tree', '-r', '--name-only', from])
      .split('\n')
      .filter((path) => path.startsWith('test/') && path.endsWith('.test.ts'))
      .map((path) => path.slice('test/'.length, -'.test.ts'.length));
  } catch {
    console.error(
      'cannot find a merge base with origin/main — fetch it first (CI needs fetch-depth: 0)',
    );
    process.exit(1);
  }

  const violations: Violation[] = findViolations(commits, seeded);
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