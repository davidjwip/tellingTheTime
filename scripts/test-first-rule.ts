/**
 * The test-first rule, and nothing that touches git.
 *
 * Split out from the binary for one blunt reason: the first version guarded `main()` with
 * `process.argv[1]?.includes('check-test-first')`, and under vite-node argv[1] is the vite-node
 * binary — so the gate never ran, printed nothing, and exited 0. It passed CI by being absent.
 * A rule that cannot be imported and asserted is a rule that can quietly stop existing.
 */

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

/**
 * Parse `git show --name-status` output.
 *
 * Renames and copies emit THREE columns (`R100<TAB>old<TAB>new`); reading column 2 as the path
 * reports the old name and hides the new one, which is how a module could arrive untested by being
 * renamed into place. A rename is treated as an addition of the new path, which is the strict
 * reading.
 */
export function parseNameStatus(raw: string): ChangedFile[] {
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const columns = line.split('\t');
      const status = columns[0] ?? '';
      const last = columns[columns.length - 1] ?? '';
      const renamed = status.startsWith('R') || status.startsWith('C');
      return { status: renamed ? 'A' : status, path: last };
    })
    .filter((file) => file.path.length > 0);
}

/**
 * The baseline decides where the rule starts, so moving it is how you get out of the rule.
 *
 * Refusing every move made it impossible to advance at all - the rule would be frozen forever, and
 * a PR that tried to extend the exemption list could never satisfy it. So a move is allowed only in
 * a commit that touches NOTHING BUT the baseline file: one file, one commit, reviewed like any
 * other. Moving it next to real work is refused, which is the difference between extending a rule
 * and escaping it.
 */
export function auditBaselineMove(
  commits: readonly Commit[],
  onMain: string,
  branch: string,
  baselineFile = 'tests-first.baseline',
): string | null {
  const touching = commits.filter((c) => c.files.some((f) => f.path === baselineFile));

  if (touching.length === 0) {
    return `this branch says ${branch} but no commit in it changed the baseline (main has ${onMain})`;
  }
  if (touching.length > 1) {
    return `the baseline changed in ${touching.length} commits; it may advance once, on its own`;
  }

  const mover = touching[0]!;
  const others = mover.files.filter((f) => f.path !== baselineFile).map((f) => f.path);
  if (others.length > 0) {
    return `${mover.sha} moves the baseline and also changes ${others.join(', ')} - ` +
      'moving the start line alongside real work is how you escape the rule';
  }
  return null;
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
          why: 'changed without touching its test, and no earlier test exists',
        });
      }
    }

    for (const module of touchedTests) tested.add(module);
  }

  return violations;
}

/**
 * Liveness check, run on every invocation.
 *
 * This exists because the gate's first incarnation could not fail: it was never called, so it
 * exited 0 whatever the history said. A gate that cannot detect a planted violation is broken
 * whatever it reports, so it proves itself before it judges anything.
 */
export function assertRuleWorks(): void {
  const planted: Commit[] = [
    { sha: '0000000', subject: 'planted: module and test in one commit', files: [
      { status: 'A', path: 'src/planted.ts' },
      { status: 'A', path: 'test/planted.test.ts' },
    ] },
  ];
  if (findViolations(planted).length === 0) {
    throw new Error('the test-first rule failed to flag a planted violation — the gate is broken');
  }

  const ordered: Commit[] = [
    { sha: '0000001', subject: 'planted: test first', files: [{ status: 'A', path: 'test/planted.test.ts' }] },
    { sha: '0000002', subject: 'planted: module second', files: [{ status: 'A', path: 'src/planted.ts' }] },
  ];
  if (findViolations(ordered).length !== 0) {
    throw new Error('the test-first rule flags a correctly ordered pair — the gate is broken');
  }
}
