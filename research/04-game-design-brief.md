# 04 — The game: design and difficulty tiering

How the research becomes a website, and specifically **how difficulty is tiered** so each step is
one new idea rather than several at once.

Companion to `02-progression-ladder.md` (the teaching order) — this file is the build order.

## The product, in one sentence

A supervised clock page in the same shape as the maths and spelling games: one large clock on
screen, one question spoken aloud, the child answers, the grown-up presses ✓ or ✗ — with a level
picker that walks from "put the day in order" to "read the time to five minutes".

- No accounts. No backend. No network calls at runtime.
- No timers, no lives, no coins, no leaderboard.
- The child never reads an instruction; every prompt is spoken.
- Ten questions per round, then a celebration and a summary.

## Part 1 — How difficulty is tiered

### The mistake this avoids

The obvious way to tier a clock game is by **answer precision**: o'clock → half past → quarter →
five minutes → minute. That is the content axis, and on its own it produces a game that jumps from
"the hand is on the 3" to "there are two hands and one of them counts in fives" in a single step.
That is exactly the jump the research says young children cannot make.

Difficulty here is **three independent knobs**, and **only one may turn per level step**:

| Knob | Values | What turning it does |
| --- | --- | --- |
| **Content** — which times exist | o'clock → half past → quarter → five-minute → minute | changes what is being named |
| **Representation** — what is on the face | no face → numerals only → **hour hand only** → two hands, no marks → two hands + 5s rim → two hands + a.m./p.m. | changes how much has to be held in mind |
| **Task** — what the child does | choose one of two → read aloud → set the hands → match analogue↔digital | changes the demand, not the information |

A level is therefore a fixed triple. The reason the game can teach at all is that representation
is turned *down* while content is turned *up*: at half past, the minute hand is **hidden entirely**,
so the only thing on screen is the one idea being taught — the hour hand sitting between two
numerals.

### The tier spine

Seven tiers, 28 levels. Tier and level ids are stable strings (`t3.2`) because they are persisted
per child on the device and will end up in test names.

| Tier | Name | Levels | Content | Representation | Task |
| --- | --- | --- | --- | --- | --- |
| **T0** | Before the clock | 0.1–0.4 | day sequence, durations, days of week | none | order / choose |
| **T1** | The face is a circle | 1.1–1.4 | 1–12, the wrap, the 5s | numerals only, no hands | tap / build |
| **T2** | One hand: o'clock | 2.1–2.4 | o'clock ×12 | **hour hand only** | read / set |
| **T3** | One hand: half past | 3.1–3.4 | + half past ×12 | **hour hand only** | read / set |
| **T4** | Quarter turns | 4.1–4.4 | + :15 / :45 | two hands, no rim marks | read / set |
| **T5** | Five minutes | 5.1–5.4 | + 144 five-minute times | two hands + 5s rim, then hidden | read / set |
| **T6** | Digital and the half-day | 6.1–6.4 | same times | + digital readout, a.m./p.m. | match / read / write |
| **T7** | *Roadmap* — elapsed, 24-hour, Roman | — | — | — | not in v1 |

**Where a four-year-old actually is:** T0, moving into T1 and T2. T3 is the realistic target inside
six to twelve months. T4 is a five-year-old's work. The game must therefore be *finished and
enjoyable at T0* — a build that only becomes fun at T4 has been built for the wrong child.

### Level-by-level

Each row is a single new idea. "Face" is what is drawn; nothing else is on screen during a round.

**T0 — Before the clock** *(no clock at all; this is the tier that makes the rest work)*

| id | Level | Task | What the child does |
| --- | --- | --- | --- |
| 0.1 | Put the day in order | order 3 cards | drag three pictures (breakfast, bus, bath) into first/next/last |
| 0.2 | Yesterday, today, tomorrow | strip | a three-day strip with a moveable "today" peg; "where is yesterday?" |
| 0.3 | Which took longer? | choose 1 of 2 | two events on a **shared start line**; pick the longer one |
| 0.4 | Days of the week | order | seven day tiles dragged into order |

**T1 — The face is a circle** *(numerals only, hands hidden — the NCETM move, on screen)*

| id | Level | Task | Notes |
| --- | --- | --- | --- |
| 1.1 | Tap 1 to 12 | tap round | numerals on the rim; tap in order; wrong tap just doesn't advance |
| 1.2 | After 12 comes… | choose | the wrap: the one idea that makes a clock a clock |
| 1.3 | Count round in fives | tap round | second ring of small labels appears: 5, 10, 15 … 60 |
| 1.4 | Build the face | build | drag twelve loose numerals onto even positions — **also the diagnostic** |

**T2 — Hour hand only: o'clock**

| id | Level | Task | Notes |
| --- | --- | --- | --- |
| 2.1 | O'clock, anchor hours | read | 12, 3, 6, 9 only — the four positions children fix first |
| 2.2 | O'clock, all twelve | read | the other eight |
| 2.3 | Make it o'clock | set | spoken time → child drags the hand onto the numeral |
| 2.4 | Two hands, minute hand parked | read | minute hand appears **and stays on 12**; o'clock only |

**T3 — Hour hand only: half past** *(the tier this whole design exists for)*

| id | Level | Task | Notes |
| --- | --- | --- | --- |
| 3.1 | Which one is half past? | choose 1 of 2 | one face with the hand **on** 3, one **between** 3 and 4 — surfaces the misconception |
| 3.2 | Read half past | read | hand between numerals; hour = the number it **has passed** |
| 3.3 | Make it half past | set | dragging snaps the hand to the halfway point, never to a numeral |
| 3.4 | O'clock or half past? | choose | mixed, hour hand only, adjacent-hour distractors |

**T4 — Quarter turns**

| id | Level | Task | Notes |
| --- | --- | --- | --- |
| 4.1 | A quarter turn | watch + tap | minute hand sweeps a quarter; "where does it stop?" |
| 4.2 | Quarter past | read | :15, minute hand on 3 |
| 4.3 | Quarter to | read | :45, minute hand on 9 — **and the hour named is the next one** |
| 4.4 | All four quarters | read | :00 :15 :30 :45 mixed |

**T5 — Five minutes** (turning content, not representation, then hiding the rim)

| id | Level | Task | Notes |
| --- | --- | --- | --- |
| 5.1 | Five past, ten past… | read | rim counts visible |
| 5.2 | Same, no rim | read | rim counts hidden — the real skill |
| 5.3 | Minutes to | read | the "to" side; hour hand is past halfway |
| 5.4 | All five-minute times | read | mixed |

**T6 — Digital and the half-day**

| id | Level | Task | Notes |
| --- | --- | --- | --- |
| 6.1 | Match it | match | analogue ↔ digital, same time |
| 6.2 | Write the time | write | analogue → digital digits (adult marks) |
| 6.3 | Morning or afternoon? | choose | a.m./p.m. anchored to a picture of the event |
| 6.4 | To the minute | read | the first level that needs minute precision |

### The ordering rules the tier table encodes

1. **The minute hand does not exist until T2.4, and is frozen on 12 when it first appears.** From
   T3 onwards it is hidden again. It only becomes a moving object at T4.
2. **Half past always comes with the hour hand alone.** The discrimination level (3.1) is placed
   *before* the reading level, because the misconception is easier to see than to explain.
3. **Quarter to is a separate level from quarter past**, because naming the *next* hour is a
   different operation from naming the passed one.
4. **The rim counts appear before they disappear.** 5.1 shows them, 5.2 hides them. Never the
   reverse.
5. **a.m./p.m. is anchored to an event picture, never to the numeral alone** — the misconception is
   that 7:45 in the morning is impossible.

## Part 2 — Task archetypes and how they are marked

| Task | What the child does | How it is marked | Why |
| --- | --- | --- | --- |
| `order` | drags cards into sequence | auto (the order is the answer) | no ambiguity, and the child sees it |
| `choose` | taps one of two (three for T5+) | auto | discrimination is the teaching point |
| `build` | drags numerals onto the rim | auto with tolerance | diagnostic, see below |
| `read` | **says the time aloud** | **adult presses ✓ / ✗** | the house model; a four-year-old cannot type and should not be self-marking pronunciation |
| `set` | drags the hand(s) | auto (the face shows the answer) then adult presses Continue | self-marking is safe here because the child cannot fool himself |
| `match` / `write` | taps a digital time / writes it | auto / adult | — |

**The one place the house rule bends, and why:** the maths and spelling games are strictly
adult-marked because "did he say it right?" is not machine-checkable. Clock *setting* is — the
hands either point at 3 or they don't. So `set` is auto-marked, but it still requires an adult to
press Continue, because the conversation after the answer is the point. `read` stays adult-marked.
Do not let `set` become the only mode.

**Build-the-face tolerance.** Numerals count as placed if within 12° of their ideal position and
there are twelve of them. Score 0–12; ≥10 is a pass. This is the diagnostic from MacDonald &
Murphy (2020) made playable, and it is worth logging the child's score on the setup screen for the
adult, not for the child.

## Part 3 — Data model

One declarative level file drives everything; nothing about a level lives in the view layer.

```ts
type Task = 'order' | 'choose' | 'build' | 'read' | 'set' | 'match' | 'write';
type HandMode = 'none' | 'hour' | 'both' | 'bothParked';  // bothParked = minute hand locked to 12

interface Level {
  id: string;                 // 't3.2' — stable, used in tests and localStorage
  tier: 0|1|2|3|4|5|6;
  title: string;              // adult-facing
  task: Task;
  minutes: number[];          // the exact minute-values allowed, e.g. [0] / [0,30] / [0,15,30,45]
  hours?: number[];           // optional subset, e.g. [12,3,6,9] for 2.1
  face: {
    hands: HandMode;
    numerals: boolean;        // T1.4 turns these off while building
    minuteMarks: boolean;
    minuteLabels: boolean;    // the 5/10/15… ring
    pastToShade: boolean;     // right half tinted for 'past', left for 'to'
    showDigital: boolean;     // T6
  };
  answer: 'spoken' | 'dragHands' | 'tapOne' | 'buildFace' | 'orderCards';
  itemsPerRound: 10;
  audio: { prompt: string; phrases: 'time' | 'event' | 'cards' };
}
```

Rounding rule: `minutes[]` is always a subset of `[0,5,10,…,55]`; T6.4 is the only level that may
hold a non-multiple of 5, and it is out of v1.

### Clock geometry — the invariant that must not be broken

```ts
minuteAngle = minutes * 6;                                  // degrees, 0 = up
hourAngle   = (hour % 12) * 30 + minutes * 0.5;             // geared — moves continuously
```

At `3:30` the hour hand is at **105°**, exactly halfway between the 3 (90°) and the 4 (120°). At
`12:30` it is at 15° — already past the 12, which is why half past twelve reads as *twelve*, not
one. At `9:45` it is at 292.5°, just short of the 10.

**Any implementation that snaps the hour hand to a numeral teaches the central misconception
directly.** This is the highest-value unit test in the repo, and it comes before any UI exists.

## Part 4 — Screens

Layout parity with `simpleKindergartenAdditionWebpage` (`maths.zt489.com`) — same tokens, same
regions, no new visual language:

```
pastel gradient page
└── centred white rounded card
     ├── h1 (red, rounded type) + small teal subtitle
     ├── pill button row      [ Level ▾ ] [ 🔊 − / + ] [ A− / A+ ]
     ├── content box          ← the clock, or the sequence strip, in the
     │                          pale-yellow teal-bordered .problem-area
     ├── prompt               ← short, spoken too; never an instruction to read
     ├── pad row              ← [ ✓ Got it ] [ ✗ Not yet ] for read
     │                          [ Done ]              for set / order / build
     ├── progress track       ← ten steps, one per correct answer
     └── footer               [ Change level ]
```

- **The clock goes where the equation was.** One element, enormous, nothing competing.
- **Setup screen** = level grid grouped by tier, with a suggested next level highlighted; badge
  shelf beneath; volume and size persist.
- **Summary screen** = ✓ of 10, the level's badge if cleared, "again" and "change level". No
  percentage, no grade, no comparison to last time.

## Part 5 — Gamification the evidence supports

The app meta-analysis picture is positive but modest — **≈ +0.31 SD** across 36 interventions, with
larger effects for preschool than K–3 and inflations from researcher-made measures (Kim et al.
2021) — and the reviews keep naming **adult-guided play** and **age-appropriate design** as the
moderators that separate learning from screen time (Alotaibi 2024; EEF's five recommendations for
ages 3–7). So the reward design is deliberately thin.

**In:**

| Device | Detail |
| --- | --- |
| **Path to the party** | ten-step track, one step per correct answer; the maths game's device |
| **Celebration** | overlay + sound when the track completes; dismissible; **fires again next round** (remembering *which* milestone, not a boolean) |
| **Streak** | "🔥 n in a row · best n", hidden at zero |
| **Badges** | one per level cleared (≥8/10), drawn as a small clock face showing that level's signature time — a collection, not a currency |

**Out, deliberately:**

| Excluded | Reason |
| --- | --- |
| Timers, countdowns | rewards speed over reading; the research is explicit that a young child's bottleneck is working memory, and pressure makes it worse |
| Lives / three strikes | failure framing. The adult's word is "not yet" |
| Coins, gems, unlock economies | turns a two-minute shared activity into a grind, and shifts motivation to the currency |
| Leaderboards, daily-streak guilt | nothing to compare against, and it makes skipping a day feel like losing |
| Self-marked rounds with no adult | the moderator that matters is the adult |

## Part 6 — Audio

Speech is pre-generated, one voice, committed as mp3s — the same pipeline as the spelling game
(en-GB, rate −8%, mono 22.05 kHz, loudness-normalised to −14 LUFS). Browser TTS is a fallback only.

The phrase set is small because it is generated from the level data, not written by hand:

- **Time phrases:** 12 o'clock + 12 half past + 24 quarter + 144 five-minute = **192**, of which
  v1 (T0–T4) needs **48**. Generate all 192 now; it is a few MB and it removes the fallback.
- **Prompts:** ~12 ("What time is it?", "Make half past three", "Which one is half past two?").
- **Praise:** short and non-specific — a chime plus "Well done", never "wrong".

Runtime rule from the spelling build: speak each new item automatically on arrival, guarded by an
item key so a re-render does not re-speak it; a speaker button repeats on demand.

## Part 7 — Round structure

- **10 items per round**, drawn from the level's content set without immediate repeats.
- **A missed item returns three items later** in the same round. Spaced, not immediate — repeating
  it straight away teaches him that "not yet" means "try the same thing until the adult gives up".
- **No auto-advance.** The next item appears when the adult presses.
- **Clearing a level** = ≥8/10. Two cleared rounds in a row highlights the next level as
  *suggested*; it never unlocks automatically, and no level is ever locked.
- **Wrong answers are not shown as wrong to the child.** The face simply stays; the adult decides
  whether to say the time and move on.

## Part 8 — What v1 is, and what it is not

**v1 scope: T0–T4** (20 levels). That reaches quarter past / quarter to, which is the ceiling of
what is useful to a four-to-five-year-old, and it is where 48 audio phrases and 60 distinct times
cover everything.

| | v1 | Later |
| --- | --- | --- |
| Tiers | T0–T4 | T5, T6 |
| Tasks | order, choose, read, set, build | match, write |
| Audio | all time phrases pre-generated | — |
| Storage | level, volume, size, streak, badges | per-item history, so missed times return sooner |
| Hosting | static build, GitHub Pages, `base: './'` | `clock.zt489.com` on Cloudflare Pages |

Deliberately **not** in v1, and not because of time: elapsed time (T7), 24-hour time, Roman
numerals, any notion of a "test", any parent analytics beyond the build-the-face score.

## Part 9 — Architecture and gates

Same stack as `plm-flashcards`: Vite + TypeScript, no UI framework, vanilla DOM, Vitest for logic,
Playwright for flows, static build to `dist/`.

```
src/engine.ts      pure: angles, phrase lookup, level configs, question generation (seeded), verdicts
src/levels.json    the 20 v1 levels, declarative
src/clockFace.ts   SVG renderer: given a time + level.face, draw it
src/app.ts         screens: setup → play → summary
src/audio.ts       manifest lookup, play, volume
src/storage.ts     localStorage: level, volume, size, streak, badges
scripts/validate-levels.mjs   the content gate (below)
```

`src/engine.ts` must have **no DOM access**, so every rule above is testable without a browser.

**Level validator** (`npm run validate:levels`) — fails the build on:

- a level id that is not unique, or a tier with no levels
- a `minutes` value that is not in the level's declared content set, or not a multiple of 5 below T6.4
- an `answer` type the level's `face` cannot support (e.g. `dragHands` with `hands: 'none'`)
- a `minutes` array with fewer than 4 values where `itemsPerRound: 10` (a round would repeat)
- an audio key with no file in the manifest
- a tier that turns two knobs at once against the table in Part 1

That last check is unusual and worth writing: it encodes the pedagogy as a test, so a future
change cannot quietly reintroduce the two-hands-at-once jump.

## Part 10 — Draft acceptance criteria (input to the spec, not the spec)

Given / When / Then, for the spec review:

1. **Geared hour hand.** Given a clock showing 3:30, when the face renders, then the hour hand is
   at 105° (±0.5°) — halfway between the 3 and the 4 — and not on either numeral.
2. **Half past hides the minute hand.** Given level `t3.2`, when a question is shown, then no
   minute hand and no minute labels are rendered.
3. **Half past names the passed hour.** Given a face with the hour hand between 2 and 3, when the
   adult marks the child's answer, then the accepted answer is "half past two" and "half past
   three" is recorded as not yet.
4. **The discrimination level shows the misconception.** Given level `t3.1`, when two candidate
   faces are drawn, then exactly one has its hand on a numeral and the other between numerals.
5. **Reading is adult-marked; setting is not.** Given a `read` level, when the child answers, then
   only ✓ and ✗ are offered; given a `set` level, then the app evaluates the hand position itself
   and offers Continue.
6. **A missed item returns, spaced.** Given a wrong answer at item 2 of 10, when the round
   continues, then that item reappears at position ≥5 and not at position 3.
7. **Celebration fires every round it is earned.** Given a completed track last round, when a new
   round's track completes, then the celebration fires again.
8. **No level is locked.** Given a fresh install, when the level picker is opened, then every
   level in T0–T4 is selectable.

## Part 11 — Decisions needed before the spec

| # | Decision | Recommendation |
| --- | --- | --- |
| 1 | Default task at a new level: `read` (adult marks) or `set` (drag hands)? | `read` first — it is the skill being taught; `set` is the same level's second half |
| 2 | Badges, or just the path-to-the-party track? | Badges — one per level, cheap to draw, and it gives the adult a visible "where is he" map |
| 3 | English audio only, or Cantonese too? | English now (one voice, matches the other two games); Cantonese as a second phrase set later if wanted |
| 4 | Does the setup screen show the child's name? | No names in the repo; a name *may* be typed on-device and stored locally only |
| 5 | Tiers locked until cleared, or all open? | All open, with a suggested next level — the adult is the scheduler |
| 6 | Domain | `clock.zt489.com`, Cloudflare Pages, after GitHub Pages proves it |

## Part 12 — Decisions taken

### 2026-10-23 — the UK ladder is the spine

o'clock → half past → quarter past / quarter to → five minutes → nearest minute. This confirms
tiers T2–T6 as the sequence and removes the alternative ("HK's short, steep spine") from
consideration as the teaching order.

Consequences for the build:

- **T4 (quarter turns) is a real rung, not an optional extra** — so it stays in v1's scope.
- **T5 (five minutes) is a designed rung, deliberately deferred** from v1. It is *data plus audio*,
  not architecture: the `Level` schema already expresses it, so shipping it later is 4 levels in
  `levels.json` and 144 generated phrases. Nothing has to be redesigned.
- **Drawing hands stays** (T1.4 build-the-face, T2.3/T3.3 set-the-hands) as an assessment device,
  not because Hong Kong requires it.
- Tier locking stays off, so if school moves faster than the game the adult can jump a tier.

### 2026-10-23 — the other six, answered

| # | Question | Decision | Effect on the build |
| --- | --- | --- | --- |
| 1 | Default task at a new level | **Reading first**, setting after | `round[]` is an ordered array; every level that has both opens with `read` steps. Validator enforces the ordering. |
| 2 | Badges vs. party track | **Both** | Badge per level cleared (persistent, on the setup shelf); path-to-the-party per round of ten (transient, inside the round). Two separate reward surfaces, not one. |
| 3 | Audio language | **English default, Cantonese toggle** — the kindergarten is Cantonese-medium | Adds an i18n layer and a `defaultLocale` toggle to header. The Cantonese phrase table is **not** a translation of the English forms and needs a native check before audio is generated — see `specs/v1.md` R1. |
| 4 | Name on screen | **Yes, in `localStorage`** | Setup gets an optional name field; the value never enters a commit, a fixture or a log. |
| 5 | Tier locking | **All open**, but a badge requires **clearing** the level | Badge award is gated on ≥80% in one round, not on attempting it. Nothing is locked. |
| 6 | Hosting | **Cloudflare Pages directly** (POC, personal + family/friends) | No GitHub Pages step. `base: './'` still, custom domain `clock.zt489.com`. |

The spec that follows from these is [`specs/v1.md`](../specs/v1.md).
