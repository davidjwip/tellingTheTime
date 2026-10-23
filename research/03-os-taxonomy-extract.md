# 03 — The os-taxonomy extract (time)

The slice of **Marble Skill Taxonomy v1** that covers time, and what it is and is not good for.

Source: [`withmarbleapp/os-taxonomy`](https://github.com/withmarbleapp/os-taxonomy), forked for
pinning at [`davidjwip/os-taxonomy`](https://github.com/davidjwip/os-taxonomy). Snapshot read:
`data/manifest.json` dated **2026-10-21**, `taxonomyVersion v1`, 1,783 topics, 3,722 dependency
edges, 3,881 curriculum standards across 8 frameworks.

## Why this dataset is worth having

Every topic carries four things a parent-led practice tool needs and usually has to invent:

- `evidence[]` — observable "he has got it" statements, not knowledge claims
- `assessmentPrompt` — a parent-facing question with `{{name}}` to substitute
- `ageRangeStart` / `ageRangeEnd` — a band, plus a `type` (conceptual / procedural /
  representational / language / meta)
- prerequisite edges with `{strength: hard|soft, reason}` — *why* something must come first

The `type` field turned out to be the most useful filter here. **LANGUAGE** topics are
vocabulary. **REPRESENTATIONAL** ones *are* the clock face. **PROCEDURAL** ones are the
operations performed on it. That maps almost one-to-one onto the stages in
`02-progression-ladder.md`.

## Coverage limits — read before quoting any of this as "the research says"

| Caveat | Detail |
| --- | --- |
| **Teaching research is Maths + Science only** | 502 of 590 maths topics have a `teaching-research` record; English, History, Computing, PS&D, Life Skills and Learning to Learn have **zero**. Useful here by luck of subject, not by design. |
| **It is agent-authored, not validated** | Upstream's own `notes` field: *"Agent-authored teaching research and proposed learning activities; not empirically validated interventions."* Treat the best-practice and misconception lists as a well-organised teaching scaffold, not as evidence. Where they agree with the practitioner literature (they do, closely), that agreement is the reason to trust them. |
| **Age floor is 4, and the floor is thin** | 41 topics total contain age 4 (21 of them maths), 322 contain age 5, 489 age 6. The preschool end is genuinely sparse — a four-year-old sits at the very bottom of a dataset designed to reach 18. |
| **Age bands are wide** | 5–8 is a common band. Membership means "taught somewhere in this window", not "ready now". |
| **No HK EDB alignment** | Standards are ACARA v9, UK NC 2013, NGSS, CCSS, IB PYP, C3, plus codes-only sources. Nothing maps to Hong Kong. The HK anchors had to come from the EDB PDFs directly. |
| **One gap that matters** | There is **no topic for a.m./p.m. as a concept independent of five-minute reading**, no topic for "the clock as a number line", and no topic for hour-hand-only reading. Those three had to be written for this project. |

## The eighteen time topics

All `Mathematics / Measurement`. Age = `ageRangeStart–ageRangeEnd`.

| Topic | Age | Type | One-line scope |
| --- | --- | --- | --- |
| Comparing durations | 4–6 | language | quicker/slower, earlier/later |
| Ordering Events in Time | 4–8 | language | before/after/next, yesterday/today/tomorrow, morning/afternoon |
| Days, Weeks, Months & Years | 5–8 | language | day and month names, a year is months and weeks |
| Hours, minutes and seconds | 5–6 | procedural | measure and record in hours/minutes/seconds; 1 min = 60 s |
| **Telling Time: Hours and Half Hours** | 5–8 | representational | read and draw o'clock and half past; hour hand halfway between at half past |
| Number of minutes in an hour | 6–9 | conceptual | 60 min = 1 h, 24 h = 1 day |
| Sequence intervals of time | 6–7 | procedural | compare and order intervals |
| Telling time to 5 minutes | 6–8 | representational | five-minute reading including quarter past/to; write digitally |
| Quarter past and quarter to | 7–8 | procedural | recognise, read, show; quarter turn of the minute hand |
| a.m. and p.m. times | 7–10 | procedural | five-minute reading plus a.m./p.m. and morning/afternoon/noon/midnight |
| Comparing Time Durations | 7–9 | procedural | calculate time taken by events |
| Fractions of time and events | 7–8 | conceptual | half an hour, quarter of an hour, eighths of an event |
| Roman numeral and 24-hour clocks | 7–11 | representational | I–XII faces; 12- and 24-hour reading |
| Time to the nearest minute | 7–9 | procedural | read, write, estimate to the minute; record and compare durations |
| Time Units and Calendar Facts | 7–9 | conceptual | 60 s, days per month, leap years |
| Using a calendar | 7–8 | procedural | today's date, weekday for a date, days between |
| 12-hour and 24-hour time | 8–11 | procedural | convert between formats |
| Elapsed time problems | 8–12 | procedural | add/subtract intervals, number line |

Supporting topics the prerequisite graph pulls in, outside Measurement:

| Topic | Age | Subject/domain |
| --- | --- | --- |
| What Is a Half? | 5–8 | Fractions |
| Halves, quarters and eighths | 7–8 | Fractions |
| Reading and writing numbers to 20 | 5–6 | Number Representation & Place Value |
| Counting in 2s (i.e. skip counting in 2s, 5s, 10s) | 5–7 | Counting & Cardinality |
| Division as equal sharing | 4–7 | Multiplication & Division |

## The prerequisite graph, in full

Closure over the prerequisites of *Telling Time: Hours and Half Hours* — ten topics, and only
three of them are about clocks:

```
Telling Time: Hours and Half Hours
├─ Reading and writing numbers to 20            HARD   "Reading a clock requires recognising numerals 1–12"
│    └─ Writing digits 0-9                      HARD
│         └─ Sitting and holding a pencil       SOFT
├─ What Is a Half?                              SOFT   "Understanding 'half past' benefits from the concept of halves"
│    └─ Division as equal sharing               HARD
│         └─ Subtraction as taking away…        HARD
│              └─ How Many in Total?            HARD
│                   └─ One-to-one counting      HARD
└─ Hours, minutes and seconds                   SOFT   "GB route: Year 1 experience of hours, minutes and seconds…"
     └─ Comparing durations                     HARD
```

Downstream, it unlocks *Telling time to 5 minutes*, *Fractions of time and events* and
*Quarter past and quarter to*.

**The actionable reading of that graph:** the two things to check before any clock face appears are
**numerals to 20** (hard) and **halving** (soft, but load-bearing for half past). Both are
teachable without a clock, and both are checkable in under a minute. See the entrance diagnostic
in `02-progression-ladder.md`.

## Evidence statements and parent prompts — the four that matter first

Quoted verbatim, because the wording is the point.

**Ordering Events in Time** [4–8, language]

> Order three daily events using 'first', 'next', 'last'. Use 'yesterday', 'today', 'tomorrow'
> correctly. Describe an event as happening in the 'morning' or 'afternoon'.
>
> *Prompt:* "If you ask {{name}} to describe what happened this morning in order, can they use
> words like 'first', 'then', 'after that' — putting breakfast before leaving for school?"

**Comparing durations** [4–6, language]

> Compare two events and say which was quicker/slower. Use 'earlier' and 'later' correctly to
> describe daily events. Solve practical problems like 'Who finished first?'
>
> *Prompt:* "If {{name}} finishes their dinner before a sibling, can they tell you who finished
> earlier — and which one was quicker?"

**Telling Time: Hours and Half Hours** [5–8, representational]

> Read an analogue clock showing 3 o'clock and one showing half past 7. Write half past 7 as 7:30
> and match the digital times 3:00 and 7:30 to the right analogue clocks. Draw the hands on a blank
> clock face for half past 2, with the minute hand on 6 and the hour hand halfway between 2 and 3.
>
> *Prompt:* "If you point to a clock showing 3 o'clock or half past two, can {{name}} tell you the
> time, say which digital time (3:00 or 2:30) matches it — and draw hands on a blank clock face to
> show a time you call out?"

**Telling time to 5 minutes** [6–8, representational]

> Read an analogue clock showing 3:25 and write the time in digital form as 3:25. Write 'quarter
> past 9' as 9:15 and 'twenty to four' as 3:40. Draw clock hands to show twenty to four, with the
> minute hand on 8 and the hour hand just before 4.

Note how much each statement asks for: read, write, *and* draw. That three-way demand is the
standard the taxonomy sets for "learned", and it is stricter than a multiple-choice tap. It is
also why drawing belongs in the game rather than in a workbook.

## Misconceptions to design against

From `pedagogy.commonMisconceptions` on the relevant topics. Agent-authored, but they match the
practitioner literature point for point.

| Topic | Misconception | Design consequence |
| --- | --- | --- |
| Comparing durations | Judges duration by distance or speed — the faster/further one "took longer"; equates "stopped last" with "took more time" | Always give two events a common start; never infer duration from distance |
| Comparing durations | Confuses earlier/later (position) with quicker/slower (duration) | Ask both questions about the same pair, deliberately |
| Ordering events | Swaps yesterday and tomorrow; reverses before/after; ties morning/afternoon to particular activities | Anchor to what we *did* and *will* do; never ask for a definition |
| Hours, minutes, seconds | Reads the number on a stopwatch as the duration, ignoring where it started | Time from a common start; sand timer before stopwatch |
| Hours & half hours | **Puts or expects the hour hand exactly on a number at half past** | The geared clock is non-negotiable; never snap the hour hand |
| Hours & half hours | Reads half past by the number the hour hand is *nearest* rather than the one it has *passed* | Teach "the number it has gone past"; test with adjacent hours |
| Hours & half hours | Confuses minute and hour hands | Colour-code and make them visibly different lengths |
| Five minutes | Reads the numeral the minute hand points at as the minutes (points at 5 → "5 past", not 25 past) | Mark the 5s round the rim, then hide them |
| Five minutes | After half past, keeps counting "past" instead of switching to "to"; names the wrong hour for a "to" time | Split the face vertically: right = past, left = to |
| a.m./p.m. | Thinks each clock time happens once a day; 50 past 3 = 50 to 4; writes 3.25 with a decimal point | Anchor to breakfast/bedtime; say "twice a day"; colon not point |

## Teaching-research notes, by stage

Condensed from `teaching-research.json`. The `bestPractices` and `keyRepresentations` lists are
the most directly implementable part of the whole dataset.

**Ordering Events in Time** — learn by talking through the daily routine and retelling sequences,
not by definitions. Representations: a visual daily timeline; story-sequencing picture cards; a
yesterday–today–tomorrow strip with a moveable "today" marker.

**Comparing durations** — compare two real timed events side by side. Representations: two events
on a shared start line; sand timers; a race with a common start.

**Hours, minutes and seconds** — start and stop the tool exactly at the start and end of the
event; sand timers first because duration is *visible* as the sand falls; then 1 minute = 60
seconds by counting to a one-minute timer emptying; record informally ("about 2 minutes").

**Telling Time: Hours and Half Hours** — the closest thing in the dataset to a build spec:

> Use a geared teaching clock so children see the hour hand creep between numbers as the minute
> hand goes round. Establish o'clock first (minute hand on 12, hour hand exactly on a number),
> then half past (minute hand on 6, hour hand between). Teach that half past is **'the last number
> the hour hand has passed'**, not the number it is nearest. Always pair reading with drawing.
> Link 'half past' to halves from fractions: the minute hand has travelled half way round.

Representations it names: a geared analogue clock; blank clock faces; a clock with hands
colour-coded (short = hour, long = minute); a half-circle sweep showing the minute hand's half turn.

**Telling time to 5 minutes** — count the minute intervals in fives round the clock so each numeral
stands for a multiple of 5; split the clock right = past, left = to; teach that after half past the
times are "minutes to" the *next* hour and the hour hand is over halfway toward it; contrast
quarter past (hand just past a numeral) with quarter to (hand nearly at the next).

## Licence position — what may be committed here

- Marble's own work: **ODbL 1.0** for the database (share-alike applies to derived *databases*),
  **CC BY-SA 4.0** for their prose.
- `curriculum-standards.json` is **not theirs to license**: encumbered frameworks ship **codes
  only** (e.g. `1-ESS1-1`), with verbatim text omitted. UK NC full text is OGL v3.
- Attribution string: *Marble Skill Taxonomy v1, withmarbleapp/os-taxonomy (ODbL 1.0 / CC BY-SA 4.0)*.

**What this repo does:** quotes a handful of topics in prose, for reference and comment. That is
quotation, not redistribution of a database.

**What this repo must never do:** commit a generated JSON of the taxonomy, or a trimmed export of
it, or a "our subset" file. That is a derived database and inherits ODbL share-alike. The fork
stays a fork; the app reads it read-only, pinned by the SHA-256s in `manifest.json`:

```
topics.json                e0e8a7da3621d0f5c6c051fd541c980eba5595e6aae8f6d9c96c10a3303e9c94
dependencies.json          55ff33a58e1a8169053f7e90de560a876fee194b9149ddb3c2ac7c7cd8135cf3
teaching-research.json     573d09e28d8be99de91abae577cf5843decd021bedc256a9a9e8a8f738ae1659
```

If the app ever ships a *dataset* rather than prose, the licence question has to be answered
first — and the cheapest answer is to ship our own hand-written evidence statements in
`data/evidence.json`, derived by reading the taxonomy rather than copying it.

## How to refresh the slice

```bash
git clone --depth 1 https://github.com/withmarbleapp/os-taxonomy.git
cd os-taxonomy

# every time topic (Measurement is where all of time lives)
node -e "const t=require('./data/topics.json').topics.filter(x=>x.subject==='Mathematics'&&x.domain==='Measurement'&&/time|hour|minute|durat|calendar|day|week|month|year/i.test(x.name));console.log(t.length);console.log(t.map(x=>x.name+' ['+x.ageRangeStart+'-'+x.ageRangeEnd+']').join('\n'))"

# the prerequisite closure of one topic
node -e "
const T=require('./data/topics.json').topics, D=require('./data/dependencies.json').dependencies;
const id=T.find(x=>x.name==='Telling Time: Hours and Half Hours').id;
const seen=new Set(), stack=[id];
while(stack.length){const c=stack.pop();for(const d of D)if(d.topicId===c&&!seen.has(d.prerequisiteId)){seen.add(d.prerequisiteId);stack.push(d.prerequisiteId);}}
for(const s of seen)console.log(T.find(x=>x.id===s).name);
"
```

Re-running this after an upstream release is a five-minute job, and it is the right way to pick up
a corrected band or a new edge — not editing the fork's data.
