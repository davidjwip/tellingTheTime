# AGENTS.md — telling the time

Read this before touching anything in this repo.

## Where the repo is

**Research stage.** `README.md` and `research/*.md` are written; there is no spec and no code.
Do not scaffold an app, choose a stack in anger, or generate components until the spec in
`specs/` has been approved in the project thread.

## The one rule

**No code without an approved spec.**

- Every behaviour lives in `specs/` first, with acceptance criteria as `Given / When / Then`.
- Every acceptance criterion gets a test that fails **before** it passes.
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
6. **`read` tasks are adult-marked.** `set` tasks may self-evaluate but still need an adult to
   continue.
7. **No estimation tasks.** A four-year-old cannot judge whether something takes "about a minute".
   Order and compare instead.
8. **Every prompt is spoken.** The child does not read instructions.

## Guardrails — public repo, non-negotiable

1. **No child-identifying data.** No names, school, class, birth date or photos — in any commit,
   fixture, screenshot, log or error string. Write "a four-year-old". A name typed into the app at
   runtime lives in `localStorage` on that device and nowhere else.
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
to `dist/`, GitHub Pages first, Cloudflare Pages later. A pure engine module with no DOM, a thin
SVG rendering layer, tests against both — the same layering as the maths and spelling games.

Visual style is not up for redesign: it is the house style from
`simpleKindergartenAdditionWebpage` (`maths.zt489.com`), described in `research/04-game-design-brief.md`
Part 4.
