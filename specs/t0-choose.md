# T0 screens — the two `choose` levels (t0.2, t0.3)

Status: approved by Dave 2026-10-23 ("emojis and words are fine — George is now reading").
Scope: `choose` tasks only. `order` (t0.1, t0.4) is a separate PR because dragging is a different
interaction.

## Why these come first

The research says a four-year-old should start below the clock face: sequence words (yesterday /
today / tomorrow) and duration ("which took longer?"). These two levels are the bottom rung of the
ladder and are currently unplayable, so the app has nothing for a child of George's age.

## The interaction

A `choose` item shows **two or three cards**. Each card is an emoji with its word underneath —
the emoji tells him what it is, the word is reading practice. He taps a card.

**The tap is the answer, and the app marks it.** Unlike `read` (where only an adult knows whether
the child said "three o'clock"), a choice is checkable, so no ✓/✗ pad appears on these screens.
Wrong answers get the same encouragement sound and the item returns three places later, exactly as
a miss does elsewhere.

Prompt is spoken from the existing clips (`prompt-tap`) and shown as text for the adult.

## Content (fixed, in the level data — no new audio needed)

`t0.2 dayStrip` — three cards, always all three:

| id | emoji | word |
| --- | --- | --- |
| yesterday | ⬅️ | Yesterday |
| today | ☀️ | Today |
| tomorrow | ➡️ | Tomorrow |

Question cycles through "Which one is yesterday?" / "…is today?" / "…is tomorrow?".

`t0.3 durationPair` — two cards per item, drawn from this list; the longer one is the answer:

| left | right | longer |
| --- | --- | --- |
| 🛁 A bath | 😴 A nap | 😴 |
| 🪥 Brushing teeth | 📺 A cartoon | 📺 |
| 👁️ A blink | 🎵 A song | 🎵 |
| 🍎 A snack | 🛏️ A night's sleep | 🛏️ |
| 🚌 A bus ride | 🧦 Putting on socks | 🚌 |
| 🍚 Eating rice | 🦷 Brushing teeth | 🍚 |

Question is always "Which took longer?".

## What the code must do

1. `Item` gains `answer?: string` — the id of the card that is correct. Set when the round is built.
2. `SUPPORTED_TASKS` gains `'choose'`. `t0.2` and `t0.3` become playable; the shelf picks them up with
   no further change (it computes availability from the data).
3. `src/choose.ts` exports:
   - `chooseFor(content)` → `{ cards: Card[], answer: string } | undefined`, deterministic per level
     content kind, **no repeats of the same question twice in a row** (the same rule as clock times).
   - `renderChoose(item, lastVerdict)` → element: prompt text, the card buttons with
     `data-choice="<id>"`, each showing emoji + word; the last verdict shown in `#feedback`.
4. `play.ts` handles `[data-choice]` taps: record the verdict by comparing with `item.answer`,
   speak praise/encourage, advance. No pad on `choose` items.
5. `app.ts` renders a choose screen instead of a clock face when the item has `answer`.
6. A11y: each card is a `<button>` with an accessible name of the word (not the emoji alone).

## Acceptance criteria

- A `choose` item renders one button per card, each with `data-choice` and the word as text.
- Tapping the correct card records a correct verdict and fills a track step; tapping a wrong card
  records a miss and the item returns later.
- No ✓/✗ pad on a `choose` screen; the pad still appears on `read`.
- The same question never appears twice in a row within a level.
- `t0.2` and `t0.3` show as available on the shelf; `t0.1` and `t0.4` still show "needs dragging".
- Every new module ≥90% coverage on all four measures; `npm test`, `npm run typecheck`,
  `npm run validate:levels` and `npm run gate:tests-first` all pass.
- Tests are written **before** the implementation, in their own commit (the gate enforces this).

## Out of scope

Dragging (`order`), audio for the card words, illustrations. Do not change the clock screens, the
level data beyond `SUPPORTED_TASKS`, or the audio manifest.
