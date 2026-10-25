/**
 * Is this branch cut from the main that exists now?
 *
 * Three times in one project a branch was cut from a stale `origin/main`. Twice it cost a rebase.
 * The third time the PR proposed DELETING 240 audio clips and a whole spec amendment - and every test
 * passed, because the branch was internally consistent. A missing base is not a merge conflict; it is
 * silence.
 *
 * The rule is deliberately crude: if main has commits this branch does not, the branch is behind, and
 * pushing it publishes a tree that was never built against the repository it claims to extend.
 */

export interface BaseVerdict {
  ok: boolean;
  message: string;
}

export function baseVerdict(behind: number, branch = 'this branch'): BaseVerdict {
  if (!Number.isFinite(behind) || behind < 0) {
    return { ok: false, message: `could not measure how far ${branch} is behind origin/main` };
  }
  if (behind === 0) return { ok: true, message: `${branch} is up to date with origin/main` };
  return {
    ok: false,
    message:
      `${branch} is ${behind} commit(s) behind origin/main. Rebase before pushing: a stale base ` +
      'hides itself - the branch passes its own tests while proposing to delete work it never saw.',
  };
}
