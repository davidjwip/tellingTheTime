/**
 * Is this branch cut from the main that exists now?
 *
 * Three times in this project a branch was cut from a stale `origin/main`. Twice it cost a rebase. The
 * third time the PR proposed DELETING 240 audio clips and a whole spec amendment — and every test
 * passed, because the branch was internally consistent and had simply never seen the commits it was
 * deleting. A missing base is not a merge conflict; it is silence.
 */

/** Set to 1 to publish a branch deliberately cut from an older main (a release line). */
export const SKIP_ENV = 'SKIP_BRANCH_BASE';

export function skipRequested(value: string | undefined): boolean {
  return value === '1';
}

/**
 * How many commits on origin/main this branch lacks, or undefined when that cannot be measured.
 *
 * The reader is injected so the failure path is testable: a shallow clone, a fork whose remote is not
 * the upstream, and a missing ref all arrive here as a throw, and a gate has to say what it could not
 * do rather than print a stack trace.
 */
export function measureBehind(read: (args: string[]) => string): number | undefined {
  try {
    const raw = read(['rev-list', '--count', 'HEAD..origin/main']);
    const behind = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(behind) ? behind : undefined;
  } catch {
    return undefined;
  }
}

export interface BaseVerdict {
  ok: boolean;
  message: string;
}

export function baseVerdict(behind: number, branch = 'this branch'): BaseVerdict {
  if (!Number.isFinite(behind) || behind < 0) {
    return {
      ok: false,
      message:
        `could not measure how far ${branch} is behind origin/main — is the remote fetched? ` +
        `If this branch is deliberately cut from an older main, set ${SKIP_ENV}=1.`,
    };
  }
  if (behind === 0) return { ok: true, message: `${branch} is up to date with origin/main` };
  return {
    ok: false,
    message:
      `${branch} is ${behind} commit(s) behind origin/main. Rebase before pushing: a stale base ` +
      'hides itself - the branch passes its own tests while proposing to delete work it never saw.',
  };
}
