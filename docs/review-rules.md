# Review rules

What makes a change acceptable in this repo. The reviewer reads this **every time**; it is not advice,
it is the bar. Each rule names the failure it prevents, because a rule nobody can fail is decoration.

## 1. An assertion must be able to fail

For every new or changed assertion, ask: **what would have to break for this to go red?** If you cannot
answer, the assertion is a comment.

Prove it, at least once per PR, by breaking the thing on purpose and watching the test fail. Two
assertions in this repo's history passed with their protection deleted: a scroll check on a screen too
short to scroll, and a `test.skip` claiming Playwright cannot drag by touch (it can, through CDP).

**How this is checked:** `npm run mutants` decides it mechanically for the five behaviours it covers, and
a reviewer asks for the red run for anything new. This rule cannot be read off a diff — that is why the
mutation gate exists rather than a seventh line of advice.

Reject: assertions on a value that is constant in the test's own setup, and `expect(x).toBe(x)` in any
disguise. The subtle version is a test that **reads the constant it is testing** — the first run of
`npm run mutants` found one: a B2 test sliced the queue by `REQUEUE_GAP`, so lowering the gap to zero
moved the expectation with the bug and the test still passed.

## 2. Coverage is a domain, not a number

A claim that "every X is covered" must name **the domain** and **how the test reaches each member**.

- exhaustive is fine when the domain is small: call the same function the UI calls, over every value;
- sampling is fine when it is not: say how many draws, and assert the draws actually landed on the
  interesting members;
- "the suite passes" is not coverage of anything.

This repo shipped a sweep that played one round of ten from a pool of forty-eight and called it a range.
It would have flaked, not failed.

## 3. Numbers in a PR body must be reproducible by one command

`428 tests · 99.60% statements` is a claim. Name the command that prints it, or do not write the number.
Rounding to two decimals from a single run is how a claim becomes false without anybody lying.

If an independent measurement disagrees with yours, say so in the PR rather than restating yours louder.

## 4. A UI change that depends on the pointer needs a browser assertion

`test/` runs in happy-dom, which **cannot** hit-test, cannot capture a pointer, and does not implement
`touch-action`. Anything that relies on where a finger lands, on gesture ownership, or on an element
being rendered at all, needs an `e2e/` spec.

The 16 px drag target on this app's clock hands was never hit-testable — the strokes were appended
outside the `<svg>` — and 476 green tests certified it for three PRs.

**This one is mechanical:** if a PR touches `src/` in a way that changes hit areas, gestures or layout,
require a changed file under `e2e/`. `npm run mutants` includes one browser mutation for exactly this class.

## 5. A claim in prose about code must be checkable

Docstrings, PR bodies and spec amendments that say "every", "never" or "always" are read as contracts.
If the code samples, the prose says samples.

## 6. Nothing edits a dirty tree with a git shortcut

`git checkout <sha> -- <path>` on uncommitted work destroys it silently. Use `scripts/apply_patch.py`,
which refuses when the tree is dirty, refuses when it cannot tell, and prints context when an anchor
misses. `--allow-dirty` exists for a sequence of edits about to be committed; it prints a warning and
should be visible in the PR if it was used.

## What the reviewer must not do

- Restate the diff. The author knows what they wrote.
- Approve because the checks are green. The checks are what this session proved can be green and wrong.
- Invent severity. If it would not change a merge decision, it is a nit and should be labelled one.
