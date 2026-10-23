# Visual artefacts from the test suite

Every test run writes viewable files into `artefacts/`. There is no browser, no screenshot service and
no image encoder involved: the renderer builds real DOM, so an SVG face serialises to a `.svg` and a
whole screen serialises into a standalone `.html` with the stylesheet inlined.

```bash
npm test            # writes them, and fails if a committed one changed
open artefacts/play-t2.2.html
```

## What gets written

| File | What it is |
| --- | --- |
| `face-t1.3-count-in-fives.svg` | the dial with the 5..60 ring and no hands |
| `face-t2.2-oclock.svg` | hour hand only, twelve numerals |
| `face-t3.2-half-past.svg` | hour hand at half past |
| `face-t4.3-quarter-to.svg` | both hands, geared |
| `play-t2.2.html` | the play screen at the start of a round |
| `play-t4.3-quarter-to-progress.html` | mid-round, four steps filled |
| `summary-t2.2.html` | the end-of-round card |
| `celebration-t2.2.html` | the party overlay |

Each `.html` is self-contained: CSS inlined, no scripts, no network. It opens by double-click and
looks like the tablet.

## Why they fail the build

A committed artefact that no longer matches what the code draws **fails the test** and names the file,
rather than being silently redrawn — otherwise the picture you approved is quietly replaced by the
picture you did not. The new output is written alongside as `<file>.actual` for comparison.

To accept a change deliberately:

```bash
UPDATE_ARTEFACTS=1 npx vitest run
git add artefacts/ && git diff --cached artefacts/
```

Read the diff before committing it. That diff is the review.

## How this relates to Playwright

These are **not** a substitute for browser screenshots. They catch: the wrong number of numerals, a
missing hand, a track that does not fill, a class that stopped being emitted, the palette drifting.
They cannot catch: layout, font loading, whether the cream frame actually looks cream, or anything
about a real viewport.

Playwright, when it arrives, screenshots the same screens in Chromium at tablet size and compares
against these files as the reference. So this is not throwaway work — it is the reference set.

## What they are not

Not shipped assets. `artefacts/` is generated, committed for review, and never served. Not a
snapshot-test monopoly either: the assertions in `test/app.test.ts` state what the screen must
contain; the artefacts show it.
