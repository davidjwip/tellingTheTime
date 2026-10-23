# specs/design-parity.md — visual contract with `simpleKindergartenAdditionWebpage`

**Status: binding.** The clock app must be visually indistinguishable from the maths app at a
glance. This file is the contract; `specs/v1.md` §5 defers to it.

Source of truth: `github.com/davidjwip/simpleKindergartenAdditionWebpage` at `main`, read directly —
`src/style.css` (798 lines), `src/App.vue` (333 lines), `index.html`, `package.json`,
`vite.config.js`. Every value below is quoted from that source, not remembered.

**Rule for the build: copy, don't invent.** Where a token or class exists in the reference, reuse
its *name and value*. New classes are allowed only for things the maths app does not have (the
clock itself, the drag handles). When in doubt, open the reference stylesheet.

---

## 1. The stack question — needs a decision (see §8)

The maths app is **Vue 3 + Vite** (`vue ^3.4.21`, `@vitejs/plugin-vue`, happy-dom for tests,
`base: './'`). `plm-flashcards` is **vanilla TS + Vite**. Both are Vite static builds to `dist/`.

**Recommendation: vanilla TS, with the maths stylesheet and markup structure copied verbatim.**
The visual layer is CSS plus the same DOM skeleton; the framework is invisible to the eye, and
vanilla keeps this repo consistent with the newest one. The counter-argument is that copying
`App.vue`'s structure into a Vue app is literally free — see §8 for the decision.

Either way the CSS below is identical.

## 2. Design tokens — copy exactly

### 2.1 Colour

| Role | Value | In the reference |
| --- | --- | --- |
| Page gradient | `linear-gradient(135deg, #ffd1dc, #a2d8f1)` | `body` |
| Card | `rgba(255, 255, 255, 0.9)` | `.container` |
| Primary red | `#ff6b6b` | `h1`, `.action-btn`, `.operator`, `.operator-active` (−) |
| Red hover | `#ff5252` | `.action-btn:hover` |
| Teal | `#4ecdc4` | `.instructions`, all borders, `.mute-btn`, `+` active, footer |
| Teal dark | `#3aa897` | teal hover states |
| Panel grey | `#f8f9fa` | `.touchpad-container`, `.goal-track` |
| Cream (the answer box) | `#fff9c4` | `.problem input` |
| Step grey | `#e0e0e0` | `.step`, `.progress-bar`, `:disabled` |
| Body text | `#333` | `body`, inputs |
| Muted text | `#7f8c8d` | `.step`, `.streak-best` |
| Label grey | `#555` | `.name-input label`, `.mascot-picker label` |
| Streak brown | `#e67e22` | `.streak-count` |
| Streak panel | `linear-gradient(135deg, #fff3cd, #ffe69c)` | `.streak-area` |
| Celebration title | `#ffd1dc` on `#ff6b6b` shadow | `.celebration-title` |
| Celebration scrim | `rgba(0, 0, 0, 0.85)` | `.celebration-overlay` |
| Modal scrim | `rgba(0, 0, 0, 0.5)` | `.limit-popup` |
| Chip hover / active | `#e0f7fa` / `#b2ebf2` | `.touchpad-btn` |
| Mascot selected | `linear-gradient(135deg, #4ecdc4, #a8e6cf)` | `.mascot-btn.selected` |

### 2.2 Type

```css
font-family: 'Fredoka', 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', sans-serif;
```

Fredoka at weights **400 and 600**. Sizes:

| Element | Size | Mobile |
| --- | --- | --- |
| `h1` | `2.5rem`, `text-shadow: 2px 2px 0 #ffd1dc` | `2rem` ≤768 |
| `.instructions` (subtitle) | `1.2rem`, teal | — |
| `.problem input` (value box) | `4rem` | `3.5rem` ≤768, `3rem` ≤480 |
| `.operator` | `2rem` bold | `1.5rem` ≤480 |
| `.equal-sign` | `2rem` bold | **unchanged** at ≤480 (no rule in that breakpoint) |
| `.touchpad-btn` | `1.5rem` bold | `1.2rem` ≤768, `1rem` ≤480 |
| `.action-btn` | `1rem` | `0.9rem` ≤480 |
| `.action-btn.small` | `0.9rem` | `0.85rem` ≤480 |
| `#feedback` | `1.5rem` bold, `min-height: 40px` | — |
| `.celebration-title` | `3rem` | — |
| `.step` | `1rem` bold | `0.85rem` ≤480 |
| `.mascot` / `.goal-end` | `2.5rem` | `1.5rem` ≤480 |
| `.streak-count` / `.streak-fire` | `1.5rem` / `2rem` | — |
| `footer` | `1.2rem`, teal | — |

### 2.3 Shape and depth

| Element | Radius | Shadow |
| --- | --- | --- |
| `.container` | `20px` | `0 10px 30px rgba(0,0,0,0.2)` |
| `.problem-area`, `.progress-area`, `.settings-panel` | `15px` | `0 5px 15px rgba(0,0,0,0.1)` |
| `.touchpad-container`, `.goal-track`, `.streak-area` | `15px` | **none** — verified: no `box-shadow` in the reference |
| inputs, `.touchpad-btn`, `.step` | `10px` / `8px` (step) | — |
| `.action-btn` | `50px` (pill) | `0 5px 15px rgba(0,0,0,0.2)` |
| segmented pair | `8px` outer corners only | — |
| active toggle ring | — | `0 0 0 4px rgba(78,205,196,0.4)` (teal) / `rgba(255,107,107,0.4)` (red) |
| `.step.filled` | — | `0 2px 8px rgba(78,205,196,0.4)` |
| `.limit-popup-content` | `20px` | `0 10px 30px rgba(0,0,0,0.3)` |

### 2.4 Layout and motion

- `body { padding: 10px }`, reset `* { box-sizing: border-box; margin: 0; padding: 0 }`.
- `.container { max-width: 600px; margin: 0 auto; padding: 15px; text-align: center }` —
  `padding: 10px` at ≤768.
- `.header-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 10px }`
  — `gap: 6px` at ≤480.
- `.problem-area { padding: 15px; margin-bottom: 15px }`; `.touchpad-container { padding: 10px; margin: 10px 0 }`.
- `.goal-track { display: flex; gap: 6px; padding: 10px; justify-content: space-between }`.
- `.step { width: 35px; height: 35px; border-radius: 8px }`, `.goal-steps { gap: 5px }`.
- `.progress-bar { height: 25px; border-radius: 15px }`, fill
  `linear-gradient(90deg, #4ecdc4, #ff6b6b)`, `transition: width 0.5s ease`.
- Animations: `pulse` (1s title / 2s streak), `bounce` (1s alternate), `fadeIn` 0.5s,
  `slideDown` 0.3s, `transition: all 0.2s|0.3s ease` on interactive elements.
- Breakpoints: **768** and **480** only. No others.

## 3. Fonts — one deliberate change

The reference does `@import url('https://fonts.googleapis.com/css2?family=Fredoka:...')`. That is a
**runtime request to a third party**, which conflicts with `v1` AC-34 (a round must complete
offline) and with the no-network-at-runtime non-goal.

**Change:** self-host Fredoka 400/600 as `woff2` in `public/fonts/`, declared with `@font-face` and
`font-display: swap`. Same family, same weights, same fallback stack — visually identical, no
request to Google, works offline. This is the one place the clock app deliberately differs from the
reference in source, and not in appearance.

## 4. Region map — 1:1 with the reference

Same skeleton, same class names, same order. The clock replaces the equation; nothing else moves.

```
body  (gradient)
└── div.container                 (white card, 600px, radius 20)
     ├── header
     │    ├── h1                   red, Fredoka 600, pink text-shadow
     │    ├── p.instructions       teal subtitle
     │    └── div.header-actions   pills, gap 8
     ├── div.settings-panel        (hidden unless 👤 pressed)
     ├── div.limit-popup           (hidden unless Level pressed) — modal scrim + white card
     ├── main
     │    ├── div.problem-area     white panel, radius 15
     │    │    ├── div.clock-frame ← THE CLOCK (replaces .problem input box)
     │    │    └── div.feedback-area > #feedback
     │    └── div.pad-container    ← replaces .touchpad-container
     │         └── div.pad         ✓ Got it | ✗ Not yet   (replaces .touchpad)
     ├── div.streak-area           yellow gradient, 🔥 n in a row
     ├── div.progress-area
     │    ├── h2                   "Path to the Party! 🎉"
     │    └── div.goal-track       mascot | steps | 🎉
     └── footer
└── div.celebration-overlay        dark scrim, bouncing title, "Keep Playing!"
```

### 4.1 Header pills — the mapping

The reference has five pills: `How to Use`, a segmented `+ / −`, `🔢 Limit: N`, `🔊`, `👤`.

| Clock app pill | Copies | Behaviour |
| --- | --- | --- |
| `Level` (segmented? no — single pill) | `🔢 Limit: N` | opens a popup styled exactly like `.limit-popup` (scrim `rgba(0,0,0,0.5)`, white 20px card, preset buttons, Cancel/Save) |
| `EN / 粵` — **segmented pair** | the `.operator-toggle` pair | two `.action-btn.small` in a `.operator-toggle`; active gets the 4px ring. `EN` active ring is teal, `粵` is red — same as `+`/`−` |
| `🔊` | `.mute-btn` | identical |
| `👤` | identical | opens `.settings-panel` |

`A− / A+` from the brief is **dropped**: the reference has no size control, and adding one is a
visual departure. If size control is wanted later, it goes in the profile panel, styled as
`.limit-preset-btn`s.

### 4.2 Where the clock goes

The reference's `.problem input` is the answer box: `100×100`, `font-size: 4rem`, `border: 3px solid
#4ecdc4`, `border-radius: 10px`, `background: #fff9c4`. That cream-on-teal frame is the app's
signature.

**`.clock-frame` keeps the frame, scales the box:**

```css
.clock-frame {
  width: min(320px, 68vw);
  aspect-ratio: 1;
  margin: 0 auto;
  background: #fff9c4;
  border: 3px solid #4ecdc4;
  border-radius: 10px;
  padding: 10px;
}
```

Inside: an SVG face, `currentColor` strokes, numerals in Fredoka 600. Hour hand `#ff6b6b`, minute
hand `#333` — both thicker than a textbook clock, because a four-year-old reads at a metre.

The `color` property is set **inline** from `FACE_COLOURS` (`src/clockFace.ts`) until the play-screen
stylesheet exists, at which point it moves to a class. A test asserts that every value in
`FACE_COLOURS` appears somewhere in this document, so the palette cannot drift from the contract
even while the colours live in TypeScript rather than CSS.
Hands are visibly different lengths (`r = 0.46` and `0.70` of the radius) — the reference's
colour-plus-length language applied to hands.

### 4.3 The pad row

`.touchpad` is `display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px`. For the clock the
pad is **two equal columns**, same `.touchpad-btn` styling, larger:

```css
.pad { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-width: 500px; margin: 0 auto; }
.pad-btn { /* .touchpad-btn + */ min-height: 96px; font-size: 1.6rem; }
```

- ✓ Got it: teal fill (`#4ecdc4`, white text) — reads as "go".
- ✗ Not yet: white with a 2px teal border and `#333` text. **Not red.** The reference's red is for
  actions and errors; a child's "not yet" is neither, and `v1` B11 forbids failure signalling.

### 4.4 The feedback line

`#feedback` stays: `1.5rem` bold, `min-height: 40px` (reserved, so nothing shifts). It is the
adult's line, not the child's verdict:

- ✓ → `Got it!` in `#4ecdc4`.
- ✗ → **empty string**, not "Try again" and not a red message. Reserving the height keeps the
  layout identical without showing a four-year-old a failure.
- Round end → `You read all 10!` in `#ff6b6b`.

### 4.5 Path to the Party — N steps in rows of five

The reference hardcodes two `.goal-steps` rows of five, numbered 1–10, with the mascot on the left
(only when `streak > 0`) and 🎉 on the right. The clock app's round length varies (`v1` R5), so:

- Render `ceil(N/5)` rows of five, filling with the round's N steps; the last row may be partial.
- **N = 10 (every T2–T4 level) reproduces the reference exactly** — two rows, 1–10, mascot left, 🎉 right.
- `.step` and `.step.filled` styling unchanged.
- Below the track, keep the reference's summary line but drop the failure count:
  `Times read: X · Best streak: Y` (the maths app has `Problems Solved: X / Total Problems: Y`).

### 4.6 Profile panel and mascot — parity, currently missing

The reference has a `.settings-panel` with a name input and **eight mascots**
(`🦊🐱🐶🐰🦁🐼🚀🦄`), and the chosen mascot rides the goal track. `v1` only specified a name.

**Add both**: name (max 20 chars, `maxlength` as in the reference) and the same eight mascots, same
`.mascot-btn` 60×60 grid, same `.selected` gradient. Default mascot: **`🦊`** — the reference's
`DEFAULT_MASCOT`, `src/usePreferences.js` l.13.

### 4.7 Celebration overlay

Copy verbatim in structure and styling; change only the copy:

| Reference | Clock app |
| --- | --- |
| `🎉 Amazing Job! 🎉` | `🎉 Amazing Job! 🎉` |
| `You solved 10 problems correctly!` | `You read all 10 times!` (N interpolated) |
| `🎊🎈🚀` | `🎊🎈⏰` |
| `Keep Playing!` | `Keep Playing!` |

Same `.celebration-close-btn` (teal, pill, `15px 40px`), same bounce/pulse, same 85% scrim.

### 4.8 `index.html`

```html
<title>Telling the Time</title>
```
Same as the reference's shape otherwise: `<div id="app">`, one module script, viewport meta.

## 5. Deliberate divergences — and why

| # | Reference | Clock app | Reason |
| --- | --- | --- | --- |
| D1 | Auto-advances 2 s after a correct answer | Never advances without a human press | Research: no timers or auto-advance for a four-year-old (`research/02`) |
| D2 | App marks the answer itself | `read` tasks are marked by the adult | A spoken answer is not machine-checkable (`research/04`) |
| D3 | `#feedback` shows "Correct!" / "Try again" in colour | `✓` shows `Got it!`; `✗` shows nothing | B11: no failure signalling to the child |
| D4 | `Problems Solved: X / Total Problems: Y` | `Times read: X · Best streak: Y` | No denominator that can look like a score |
| D5 | Exactly 10 steps, two rows of 5 | `ceil(N/5)` rows for the round's N | Round lengths vary 3–10 (R5) |
| D6 | Google Fonts `@import` | Self-hosted Fredoka woff2 | AC-34 offline, no third-party request |
| D7 | Footer names the children | **Same footer, names kept** (your call, 2026-10-23) — the one permitted exception to the no-child-names rule, recorded in `AGENTS.md` | The maths repo is public and does; this repo's guardrail says no child data |
| D8 | Vue 3 SFCs | Vanilla TS (decided) | Consistency with `plm-flashcards`; the CSS does the visual work |
| D9 | Five header pills including `How to Use`, plus an `.instructions-panel` | Four pills, no instructions panel | A four-year-old reads no instructions, and the adult needs four controls, not five. The panel's styling is still the place to put level help if it is ever wanted |

## 6. Parity gate — how "the same" gets proved, not asserted

A build may not claim parity without all three:

1. **Token diff.** `npm run parity:check` extracts every colour literal, radius, shadow, font-size
   and breakpoint from the built `dist/assets/*.css` and diffs the set against a checked-in copy of
   the reference's tokens (`test/fixtures/reference-tokens.json`, generated from the maths repo).
   Any value in the clock app that is not in the reference, and is not in §4's declared-new list,
   fails the build.
2. **Screenshot comparison.** Build both apps, serve them side by side, screenshot the play screen at
   1280×800, 768×1024 and 390×844, and compare the *region geometry* (card bounds, header height,
   panel padding, track position) within 2 px. Text content differs; layout must not.
3. **Human check.** Dave looks at both on his own monitor. The two gates above catch drift; they
   cannot catch "it feels wrong".

## 7. What may be new, and nothing else

Declared-new elements — the only places the clock app may add classes or colours:

- `.clock-frame` (the cream/teal frame at clock scale), `.clock-face` (SVG), hand colours
  (`#ff6b6b` hour, `#333` minute — both already in the palette).
- `.pad` / `.pad-btn` (reuses `.touchpad` / `.touchpad-btn` styling at two columns).
- `.badge-shelf` / `.badge` (setup screen only): a 60×60 white tile with a 2px `#e0e0e0` border and
  `15px` radius — the `.mascot-btn` treatment, so the shelf reads as part of the same family.
- `.day-card`, `.day-strip`, `.week-tile` (T0/T1 material): white cards, `15px` radius,
  `0 5px 15px rgba(0,0,0,0.1)`, teal 2px border when selected.

Anything else — a new grey, a new radius, a new font weight — is a defect.

## 8. Decisions — settled 2026-10-23

| # | Decision | Answer | Effect |
| --- | --- | --- | --- |
| 1 | Vue, or vanilla TS with the same CSS and markup? | **Vanilla TS** | Vite + TS + vanilla DOM. Copy `style.css` verbatim and reproduce the `App.vue` skeleton as functions returning DOM. No `vue` dependency. |
| 2 | Footer: names or name-free? | **Keep the names** | `© 2026 David Ip. Created for George and Teddy Ip.` — identical to the maths app. This is the **only** place in the repo where a child's name may appear, and `AGENTS.md` was amended to say exactly that. |
| 3 | `A− / A+` size control | **Parked** | Not rendered in v1; `clock.v1.size` reserved. Adding it later is a UI change with no storage migration. |
| 4 | Mascots (eight emoji on the goal track) | **Keep** | As the reference: `.mascot-btn` 60×60 grid, `selected` gradient, mascot on the left of the track when the streak is above zero. |

Footer markup, copying the reference's `footer` block:

```html
<footer>
    <p>© 2026 David Ip. Created for George and Teddy Ip.</p>
</footer>
```

`footer { margin-top: 20px; color: #4ecdc4; font-size: 1.2rem; }` — unchanged.
