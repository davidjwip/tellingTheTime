# T0 screens — the two `order` levels (t0.1, t0.4)

Status: approved by Dave 2026-10-23 ("emojis and words are fine"). Scope: `order` tasks only.

## Tap in order, not drag

Dragging is the obvious reading of "put the day in order", and it is wrong for a four-year-old on a
tablet: small fingers, no hover, and a dropped card lands between two others. Tap-to-place instead:

- the cards sit in a pool, shuffled;
- tapping one moves it into the next empty slot of the answer row, in the order tapped;
- tapping a placed card puts it back in the pool (undo, because being stuck is worse than a retry);
- when the row is full, the app checks it. Right: praise and advance. Wrong: encouragement, cards
  return to the pool, and the item comes back three places later like any other miss.

The app marks it, so there is no tick/cross pad on these screens — same rule as `choose`.

## Content (fixed; no new audio)

t0.1 dayCards — three cards, shown with emoji and word:

| id | emoji | word |
| --- | --- | --- |
| morning | morning-sun | Morning |
| afternoon | sun | Afternoon |
| night | moon | Night |

Use the actual emoji characters in the code: a sunrise for morning, a sun for afternoon, a crescent
moon for night. Correct order: morning, afternoon, night.

t0.4 weekTiles — seven cards, each showing its **day number** and the word:

| number | word |
| --- | --- |
| 1 | Monday |
| 2 | Tuesday |
| 3 | Wednesday |
| 4 | Thursday |
| 5 | Friday |
| 6 | Saturday |
| 7 | Sunday |

No emoji: there is no honest picture for "Wednesday". The number is the picture — Dave's call
(2026-10-23), and it turns the order into something a four-year-old can already do: he can count to
seven, so the puzzle is reachable before the day names are known.

The number is printed large above the word, in that order, so the eye reads the number first and the
word second. This is scaffolding: once the names are secure the numbers come off, in a later level or
variant. Note in the code comment that the numerals make the task countable, so nobody mistakes this
for a test of day-name order.

## Code

1. SUPPORTED_TASKS gains 'order'.
2. src/order.ts exports:
   - orderFor(content, previous?, rng?) -> { cards: Card[], answer: string[] } | undefined.
     Cards shuffled from the rng, never already in the correct order, never the same shuffle twice
     in a row within a level.
   - renderOrder(item, placed: string[], lastVerdict?) -> element: the pool, the answer row with
     empty slots, cards carrying data-card="<id>", slots carrying data-slot.
3. Item gains an answer for order items (the correct id sequence). `choose` uses a single string; if
   that is awkward, give order its own field — but say which you chose and why.
4. play.ts handles [data-card] taps: pool to place, placed to unplace; on a full row compare with the
   answer and record the verdict.
5. picker.ts: the order reason text becomes "needs ordering", and t0.1/t0.4 become available.

## Acceptance criteria

- Cards appear in the pool, never already in the correct order.
- Tapping fills slots left to right; tapping a placed card returns it to the pool.
- The correct sequence records a correct verdict and fills a track step; a wrong sequence records a
  miss and the item returns three places later.
- No tick/cross pad on an order screen.
- The same shuffle never repeats twice in a row.
- t0.1 and t0.4 show as available on the shelf; nothing else changes availability.
- Every new module at least 90% coverage on all four measures; typecheck, validate:levels,
  test:coverage and gate:tests-first all pass. Tests land in their own commit BEFORE the code.

## Out of scope

Dragging, audio for the card words, illustrations, the tap and build levels.
