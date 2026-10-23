# AGENTS.md — telling the time

Read this before touching anything in this repo.

## Where the repo is

**Build stage.** `specs/v1.md` is approved (v1.4) and the app exists: geometry, the level validator,
the SVG face, the round engine and the play screen. The spec gate is satisfied — but it applies to
new behaviour, so a change that adds a rule still starts in `specs/`, not in `src/`.

## The one rule

**No code without an approved spec.**

- Every behaviour lives in `specs/` first, with acceptance criteria as `Given / When / Then`.
- Every acceptance criterion gets a test that fails **before** it passes.
- **This is now enforced, not remembered.** `npm run gate:tests-first` reads the commit graph and
  fails when a module under `src/` is added in a commit that no *earlier* commit tested. A change to
  a module that is already tested needs no test edit — forcing one buys empty assertions — but a new
  module must arrive with its test already in the history.
- CI runs it with `fetch-depth: 0` (no history means no commits, which would pass silently). The
  start line is the **merge base with `origin/main`**, not a pinned SHA in a file: a merge rewrites
  SHAs, so a pin goes stale the first time a PR lands and quietly widens the range. A merge base
  cannot go stale, cannot be edited, and cannot be moved without rewriting `main`.
- The gate checks it can fail before it judges: a planted same-commit violation must be flagged, or
  it aborts. The first version never ran at all (`argv[1]` under vite-node is the vite-node binary)
  and passed every history by doing nothing.
- Two exemptions exist in `scripts/test-first-rule.ts` (`EXEMPT`): `types` (type-only) and `main`
  (bootstrap). Adding a third needs a reason that survives review — an exemption nobody can argue
  with is just a hole.
- There is no baseline file to edit. Commits already on `main` are not re-judged; only the branch's
  own commits are, which is the only set a PR can be held responsible for.
- A spec is approved only when Dave says so in the thread. "The agent thinks it's clear" is not
  approval, and silence is not approval.

## Read these first, in this order

1. `research/02-progression-ladder.md` — the teaching order. Nothing on screen may contradict it.
2. `research/04-game-design-brief.md` — the tier table, the three difficulty knobs, and Part 10's
   draft acceptance criteria.
3. `research/03-os-taxonomy-extract.md` — where the evidence wording comes from, and its limits.
4. `research/01-evidence-and-readiness.md` — why the ladder starts below the clock face.

## The rules the build must not break

These come from the research, not from taste. If a change would break one, stop and ask.

1. **One difficulty knob per level step.** Content, representation, or task — never two. `npm run
   validate:levels` should fail on a violating level.
2. **The hour hand is geared.** `hourAngle = (hour % 12) * 30 + minutes * 0.5`. A snapped hour hand
   teaches the central misconception. Test it before building the face.
3. **The minute hand does not exist below T2.4,** and is frozen on 12 at T2.4.
4. **Half past keeps the minute hand hidden** (T3), and half past means *the number the hand has
   passed*, never the nearest numeral.
5. **No timers, no lives, no coins, no leaderboards.** The adult's word is "not yet".
6. **Every task is marked by the adult.** A button that records "correct" on press marks the
   child's effort as success without anyone looking. The pad is always the adult's two verdicts.
7. **A `set` task never shows its own answer.** The target is stated as text and the dial is drawn
   with no hands — parking it at 12:00 was wrong, because 12:00 is a legal target on t2.1–t2.3.
8. **A round can fail.** Clearing counts first attempts only. A round where a missed item is
   re-shown and answered must not report a perfect total — if every round ends at 100%, the 80%
   threshold and the "Good try!" screen are decoration.
6. **`read` tasks are adult-marked.** `set` tasks may self-evaluate but still need an adult to
   continue.
7. **No estimation tasks.** A four-year-old cannot judge whether something takes "about a minute".
   Order and compare instead.
8. **Every prompt is spoken.** The child does not read instructions.

## Guardrails — public repo, non-negotiable

1. **No child-identifying data — with one narrow exception.** No names, school, class, birth date or
   photos in any commit, fixture, screenshot, log or error string. Write "a four-year-old". A name
   typed into the app at runtime lives in `localStorage` on that device and nowhere else.
   **Exception (Dave, 2026-10-23):** the `footer` credit line names the two children, matching the
   maths app verbatim. That line and nothing else. The guardrail scan must allow exactly that string
   and still fail on the names anywhere else in the tree.
2. **Never commit a derived taxonomy dataset.** Quoting a handful of topics in prose is reference;
   shipping a generated or trimmed export of `os-taxonomy` creates an ODbL share-alike obligation
   on the whole database. Read the fork; do not vendor it. Our own hand-written evidence statements
   in `data/` are fine.
3. **No copyrighted teaching material.** No worksheets, workbook pages or scans from any scheme.
4. **No secrets.** No tokens, no calendar ids, no homelab addresses.

## Git workflow

- `main` is never pushed to directly. One branch per change, one pull request per branch, merged by
  Dave.
- One branch per change, created fresh from `main` after the previous PR merges. Never stack a
  second change on an open PR.
- Branch names: `spec/<slug>` for spec-only work, `feat/<slug>`, `fix/<slug>`, `chore/<slug>`,
  `research/<slug>` for research-only drops.
- An agent may commit on a branch but does not publish: pushing and opening the PR is done by the
  orchestrating agent or by Dave. The agent that wrote the change is never the one that publishes it.
- A PR body pastes the failing-test output and the passing-test output. Summaries are not output.

## Definition of done (per PR, once code exists)

- [ ] every changed behaviour has a criterion in `specs/`
- [ ] test map updated (criterion → test file → test name)
- [ ] `npm test` green, output pasted in the PR body
- [ ] `npm run e2e` green for the affected flows (Playwright, chromium)
- [ ] `npm run validate:levels` green for any level or content change
- [ ] `npm run guardrail:scan` green
- [ ] no new dependency without an entry in `specs/decisions.md`
- [ ] the guardrails above hold

## Stack, once approved

Vite + TypeScript, no UI framework, vanilla DOM. Vitest for logic, Playwright for UI. Static build
to `dist/`, deployed **straight to Cloudflare Pages** (POC scope — no GitHub Pages step). A pure
engine module with no DOM, a thin SVG rendering layer, tests against both — the same layering as
the maths and spelling games.

Visual style is not up for redesign: it is the house style from
`simpleKindergartenAdditionWebpage` (`maths.zt489.com`), described in `research/04-game-design-brief.md`
Part 4.
## Nothing leaves this machine red

`npm run hooks:install` once per clone, then `git push` runs the same checks CI runs: typecheck, the
level gate, `test:coverage` with its per-file thresholds, and the test-first gate. A failing tree
cannot be pushed to a branch.

This is not ceremony. Three pushes in this project went out having skipped the one check that would
have caught them, because the check that was already passing got re-run instead. CI is the backstop,
not the first reader; a red push costs a review cycle.

The hook lives in `.githooks/pre-push` rather than `.git/hooks` because `.git/` is not committed and
a gate nobody has is not a gate. Bypass with `GIT_HOOKS_OFF=1 git push`, deliberately and rarely.
