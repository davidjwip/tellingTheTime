# Telling the time — research base

Research groundwork for a small, supervised web game that helps a four-year-old learn to
read an analogue clock — in the same shape as the maths and spelling pages already in use
(`simpleKindergartenAdditionWebpage`, `plm-flashcards`).

**Status: research only. No application code, no spec, no build.** The next step is a spec
review, not a scaffold.

## Why this repo exists before any code

Clock reading looks like one skill. It is really six, stacked: the vocabulary of time, a
sense of how long things last, the clock face as a circle of numbers, the hour hand, the
minute hand, and the relationship between an analogue face and a digital reading. A game
built on the wrong rung teaches a child to *answer* without teaching him to *understand* —
which is the failure mode the research is most explicit about. So the reading came first,
and it is written down here so the build can point at it instead of re-deriving it.

## What is in here

| File | What it holds | Read it when |
| --- | --- | --- |
| [`research/01-evidence-and-readiness.md`](research/01-evidence-and-readiness.md) | What the evidence and the curricula actually expect at 4, 5 and 6; the six sub-skills inside clock reading; what is and is not developmentally available at four | Deciding what the game should even attempt |
| [`research/02-progression-ladder.md`](research/02-progression-ladder.md) | The eight-stage teaching ladder, with observable evidence at each stage, off-screen practice, and what the screen should show | Designing levels, modes, and the order of them |
| [`research/03-os-taxonomy-extract.md`](research/03-os-taxonomy-extract.md) | The Marble Skill Taxonomy slice for time: age bands, evidence statements, parent assessment prompts, prerequisite edges, misconceptions, and the gaps it does not cover | Choosing assessment wording; checking what "learned" means |
| [`research/04-game-design-brief.md`](research/04-game-design-brief.md) | The build-shaped consequences: **the difficulty tiering (7 tiers, 28 levels)**, task archetypes, gamification that the evidence supports, architecture, and what we deliberately will not build | Writing the spec |
| [`research/05-sources.md`](research/05-sources.md) | Every source used, with what it contributed and how much weight it deserves | Checking a claim |
| [`specs/v1.md`](specs/v1.md) | The buildable spec: level schema, the 20 v1 levels, 46 `Given / When / Then` criteria, test map, build order, risks | Approving or building |
| [`specs/design-parity.md`](specs/design-parity.md) | The visual contract with the maths app: exact tokens, region map, deliberate divergences, the parity gate | Touching anything visual |
| [`data/phrases-yue.md`](data/phrases-yue.md) | Cantonese phrase table for review — 48 time phrases + 8 prompts, three forms each | Reviewing the Cantonese |

## The five findings that shape the build

1. **Four is early, but not wrong.** A synthesis of three US studies found roughly 10% of
   four-year-olds can read an "o'clock" time, 45% of five-year-olds, and all children by
   seven (Williams 2012, as reported in MacDonald & Murphy 2020). Hong Kong's own curriculum
   guide lists o'clock reading as a *five-to-six* developmental characteristic — and adds
   the telling qualifier "depending on whether they are given the chance to learn"
   (EDB, *Kindergarten Education Curriculum Guide 2017*, Appendix 2).
2. **Instruction timing, not ability, drives the difference.** Chinese children acquire
   clock reading two years earlier than Flemish children because their curriculum exposes
   them two years earlier — 11,743 children tested (Burny, Valcke, Desoete & Van Luit 2013).
   The authors' conclusion is that the later curriculum "tends to underestimate what
   children are capable of". Starting now is defensible; expecting mastery now is not.
3. **The clock face is the last rung, not the first.** Both the NCETM's Year 1 guidance and
   the taxonomy's age bands put sequence, duration vocabulary and "the clock as a number
   line wrapped into a circle" *before* any reading. The single-handed-clock technique
   (hour hand only, minute hand introduced only when the hour hand is secure) is the
   standard way to stop the two hands overloading a young child's working memory.
4. **Reading a clock and sensing time are different competencies.** Four-year-olds can
   already order time words and events; they do not know what "a minute" *is* until years
   later (Tillman & Barner). Judgements of duration stay wobbly into the primary years
   (Friedman). A game that trains the face is fine; a game that assumes a felt sense of
   minutes is not.
5. **The evidence supports guided play with an adult, not unsupervised drilling.** The
   meta-analytic picture for educational apps is positive but modest (≈ +0.31 SD, larger
   for preschool than K–3), and the reviews consistently single out adult scaffolding and
   age-appropriate design as the moderators that matter (Kim et al. 2021; Alotaibi 2024).
   That matches the house model already used for maths and spelling: child reads, adult
   presses.

## The difficulty tiering, in one table

Difficulty is **three independent knobs** — which times exist (content), what is on the face
(representation), and what the child does (task). **Only one turns per level step.** That is the
whole design: what makes it teachable is that representation is turned *down* as content goes *up*,
so at half past the minute hand is hidden and the only thing on screen is the one idea being taught.

| Tier | Name | Levels | Content | Face |
| --- | --- | --- | --- | --- |
| T0 | Before the clock | 0.1–0.4 | day order, durations, weekdays | no clock |
| T1 | The face is a circle | 1.1–1.4 | 1–12, the wrap, the 5s | numerals only, no hands |
| T2 | One hand: o'clock | 2.1–2.4 | o'clock ×12 | **hour hand only** |
| T3 | One hand: half past | 3.1–3.4 | + half past ×12 | **hour hand only** |
| T4 | Quarter turns | 4.1–4.4 | + :15 / :45 | two hands, no rim marks |
| T5 | Five minutes | 5.1–5.4 | + five-minute times | two hands + 5s rim, then hidden |
| T6 | Digital and the half-day | 6.1–6.4 | same times | + digital readout, a.m./p.m. |

A four-year-old starts at T0 and is realistically working in T2–T3. **v1 is scoped to T0–T4** —
20 levels, 48 audio phrases — because beyond that is five-year-old work and building it now is
speculative. Full level-by-level detail, marking rules, data model and draft acceptance criteria:
`research/04-game-design-brief.md`.

## Status and next step

- [x] Research: evidence, curricula, taxonomy slice, ladder
- [x] Game plan and difficulty tiering
- [x] Seven decisions taken (UK ladder + six build questions) — `04` Part 12
- [x] [`specs/v1.md`](specs/v1.md) — v1.3: 47 acceptance criteria, no open questions
- [x] [`specs/design-parity.md`](specs/design-parity.md) — visual contract + the four parity decisions
- [x] [`data/phrases-yue.md`](data/phrases-yue.md) — Cantonese settled: colloquial throughout
- [ ] **Spec approval** in the project thread
- [ ] Test-first build, T0–T4

`specs/v1.md` is a draft until Dave approves it. Per `AGENTS.md`, no implementation code before that.

## Decisions settled

| Date | Decision |
| --- | --- |
| 2026-10-23 | UK ladder is the spine; a new level opens with reading; both reward layers; all levels open, badge needs a clear |
| 2026-10-23 | English default with a **Cantonese toggle — colloquial throughout** (`三點三` = 3:15, `三點九` = 3:45) |
| 2026-10-23 | Name in `localStorage` only; mascots kept; no size control in v1 |
| 2026-10-23 | **Vanilla TS**, deployed straight to Cloudflare Pages |
| 2026-10-23 | Look and feel is a binding contract with the maths app, including its footer credit line |

## House rules this repo inherits

- **Public repo.** No child-identifying data — no names, school, class, photos or birth date. Say
  "a four-year-old", not who. **One exception, by Dave's direction:** the footer credit line names
  the two children, exactly as the maths app does. Nowhere else.
- **No copyrighted teaching material.** Word lists, worksheets and book pages from any
  phonics or maths scheme do not belong here.
- **No third-party dataset committed.** The taxonomy is consumed read-only from a pinned
  fork; only our own prose and derived *evidence statements* live in this repo. Licence
  position is spelled out in `research/03-os-taxonomy-extract.md`.
- **Spec before code.** Once research is signed off, a spec with `Given / When / Then`
  acceptance criteria and a test-first build follows the same rules as `plm-flashcards`
  (see `AGENTS.md`).

## Attribution

Marble Skill Taxonomy v1, [`withmarbleapp/os-taxonomy`](https://github.com/withmarbleapp/os-taxonomy)
(ODbL 1.0 database / CC BY-SA 4.0 prose). Extracts here are quotation for reference and
comment; the taxonomy itself is not redistributed.
