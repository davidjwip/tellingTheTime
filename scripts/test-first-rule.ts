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
/**
 * A test file may specialise: `engine.test.ts` and `engine.tier.test.ts` both test `engine`. Without
 * this, a suite split by topic would look like no test at all, and the gate would report a module as
 * untested while its tests sat next to it.
 */
export function covers(tested: ReadonlySet<string>, module: string): boolean {
  if (tested.has(module)) return true;
  for (const name of tested) if (name.startsWith(`${module}.`)) return true;
  return false;
}

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

export function findViolations(
  commits: readonly Commit[],
  initiallyTested: Iterable<string> = [],
): Violation[] {
  // Modules that already have a test on the base branch are tested, whether or not this branch
  // touches their test file. Without this seed the rule demanded a test edit in EVERY pull request
  // that changed a module — busywork that pushes people to add empty assertions.
  const tested = new Set<string>(initiallyTested);
  const violations: Violation[] = [];

  for (const commit of commits) {
    const touchedTests = new Set(commit.files.filter((f) => isTest(f.path)).map((f) => moduleOf(f.path)));

    for (const file of commit.files) {
      if (!isSrcModule(file.path)) continue;
      const module = moduleOf(file.path);
      if (EXEMPT.has(module)) continue;

      const added = file.status.startsWith('A');
      const testHere = covers(touchedTests, module);
      const testEarlier = covers(tested, module);

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