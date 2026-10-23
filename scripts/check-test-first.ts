/**
 * Test-first gate.
 *
 * A promise in a document is not a gate. This reads the commit graph and fails when a commit adds a
 * module under src/ that no earlier commit tested, or changes a module without touching a test in
 * the same commit. The rule:
 *
 *   NEW module   - a test naming it must ALREADY exist in an earlier commit (strictly: that is what
 *                  test-first means, and it is what makes a red commit visible in the log)
 *   CHANGED      - the module must already be tested somewhere earlier in the range. The commit does
 *                  NOT have to touch the test, deliberately: forcing a test edit on every change to
 *                  a file buys assertion churn, not coverage, and a comment fix should not need a
 *                  fake expectation to get past a gate.
 *
 * Exemptions are listed below with a reason each, because an exemption nobody can argue with is
 * just a hole.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export interface ChangedFile {
  status: string;
  path: string;
}

export interface Commit {
  sha: string;
  subject: string;
  files: ChangedFile[];
}

export interface Violation {
  sha: string;
  subject: string;
  path: string;
  why: string;
}

/** Glue with nothing to assert. Keep this list short and keep the reasons true. */
export const EXEMPT = new Map<string, string>([
  ['types', 'type-only: erased at build time, no statements to assert'],
  ['main', 'bootstrap: picks a level and calls mountPlay, which is tested directly'],
]);

const isSrcModule = (path: string): boolean => path.startsWith('src/') && path.endsWith('.ts');
const isTest = (path: string): boolean => path.startsWith('test/') && path.endsWith('.test.ts');

/** 'src/clockFace.ts' -> 'clockFace'; 'test/clockFace.test.ts' -> 'clockFace'. */
export function moduleOf(path: string): string {
  if (isTest(path)) return path.slice('test/'.length, -'.test.ts'.length);
  return path.slice('src/'.length, -'.ts'.length);
}

export function findViolations(commits: readonly Commit[]): Violation[] {
  const tested = new Set<string>();
  const violations: Violation[] = [];

  for (const commit of commits) {
    const touchedTests = new Set(commit.files.filter((f) => isTest(f.path)).map((f) => moduleOf(f.path)));

    for (const file of commit.files) {
      if (!isSrcModule(file.path)) continue;
      const module = moduleOf(file.path);
      if (EXEMPT.has(module)) continue;

      const added = file.status.startsWith('A');
      const testHere = touchedTests.has(module);
      const testEarlier = tested.has(module);

      if (added && !testEarlier) {
        violations.push({
          sha: commit.sha,
          subject: commit.subject,
          path: file.path,
          why: testHere
            ? 'added with its test in the same commit — the test must come first'
            : 'added with no test, then or before',
        });
      } else if (!added && !testEarlier && !testHere) {
        violations.push({
          sha: commit.sha,
          subject: commit.subject,
          path: file.path,
          why: 'changed without touching its test in the same commit',
        });
      }
    }

    for (const module of touchedTests) tested.add(module);
  }

  return violations;
}

/** Read the range baseline..HEAD out of git. */
export function readCommits(baseline: string, head = 'HEAD'): Commit[] {
  const shas = execFileSync('git', ['rev-list', '--reverse', `${baseline}..${head}`], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

  return shas.map((sha) => {
    const raw = execFileSync('git', ['show', '--pretty=format:', '--name-status', sha], { encoding: 'utf8' });
    const files = raw
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const [status = '', path = ''] = line.split('\t');
        return { status, path };
      })
      .filter((f) => f.path.length > 0);

    const subject = execFileSync('git', ['show', '-s', '--format=%s', sha], { encoding: 'utf8' }).trim();
    return { sha: sha.slice(0, 7), subject, files };
  });
}

function main(): void {
  const baselineFile = 'tests-first.baseline';
  if (!existsSync(baselineFile)) {
    console.error(`no ${baselineFile}: refusing to guess where the rule starts`);
    process.exit(1);
  }

  const baseline = readFileSync(baselineFile, 'utf8').trim();
  let commits: Commit[];
  try {
    commits = readCommits(baseline);
  } catch {
    console.error(`cannot read ${baseline}..HEAD — is ${baseline} an ancestor? (CI needs fetch-depth: 0)`);
    process.exit(1);
  }

  const violations = findViolations(commits);
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

if (process.argv[1]?.includes('check-test-first')) main();
