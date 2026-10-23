# 05 — Sources

Every source used, what it contributed, and how much weight it deserves. Ordered by how much of
the thinking they carry.

## Tier 1 — read directly, load-bearing

| Source | Kind | Used for | Weight |
| --- | --- | --- | --- |
| **EDB HK, *Explanatory Notes to Primary Mathematics Curriculum (Key Stage 1)***, 2018 — `edb.gov.hk/…/en_ks1_e.pdf` | official curriculum | Units **1M4** (o'clock + half past, drawing hands *not* required), **2M2** (nearest minute, a.m./p.m., 24 h in a day), **3M2** (seconds), **3M4** (24-hour). The finding that HK has **no quarter-hour or five-minute rung**. | Authoritative for what his school will ask |
| **EDB HK, *Kindergarten Education Curriculum Guide 2017*** — `edb.gov.hk/…/ENG_KGECG_2017.pdf` | official curriculum | Early Childhood Mathematics requires only "the concept of time … days, months and alternation of seasons" (p.41); Appendix 2 for 5–6-year-olds lists o'clock reading "but depending on whether they are given the chance to learn" (p.108) | Authoritative; the second quote is the licence to start early |
| **NCETM, Year 1 Unit 11 and Year 2 Unit 11 — Time** — `ncetm.org.uk/classroom-resources/cp-year-1-unit-11-time`, `…year-2-unit-11-time` | official practitioner guidance | The teaching *sequence*: 0–12 number line → walk it → bend it into a circle → hour hand only → o'clock → "not o'clock" = half past → only then the minute hand; then a 0–60 minutes line, fives, past/to partition | The best published sequence found; adopted almost wholesale for T1–T5 |
| **Clare Sealy (Third Space Learning), *Teaching Time & Telling Time in Elementary School*** | practitioner, named author (ex-headteacher, OBE) | Two techniques: the **hour-hand-only** sequence, and the working-memory argument that teaching both hands at once overloads the child | Very high practical weight; the cognitive-load claim is standard (≈4 chunks) |
| **MacDonald & Murphy (2020), *Young Children's Understandings of Clocks at the Start of School*, IJMTL 21.1** — CSU repository PDF | peer-reviewed | 132 children's clock drawings: ~11% spaced the twelve numerals evenly; partitioning correlates with numeral-sequence knowledge (rho 0.49); most children arrive with *some* structural knowledge; Pengelly's five stages; the drawing-telling method | Directly shapes T1.4 "build the face" as a diagnostic |
| **Burny, Valcke, Desoete & Van Luit (2013), *Curriculum sequencing and the acquisition of clock-reading skills among Chinese and Flemish children*, IJSME 11:761–785** | peer-reviewed, n = 11,743 | Chinese children acquire clock reading 2 years earlier from 2 years' earlier exposure; the late curriculum "tends to underestimate what children are capable of" | The single best argument that instruction timing — not readiness — sets the age |
| **Marble Skill Taxonomy v1** — `github.com/withmarbleapp/os-taxonomy` | open dataset (ODbL 1.0 / CC BY-SA 4.0) | Age bands, evidence statements, parent assessment prompts, prerequisite edges with reasons, misconception lists, best-practice lists | Excellent *scaffold*; its teaching research is explicitly "agent-authored … not empirically validated" — used where it agrees with the practitioner literature |

## Tier 2 — read directly, supporting

| Source | Kind | Used for |
| --- | --- | --- |
| **Tillman & Barner, *Learning the language of time: children's acquisition of duration words*** (UCSD; OSF PDF) | peer-reviewed (preprint) | Preschoolers infer the *ordering* of time words but not their absolute durations; absolute duration knowledge comes years later. Rules out estimation tasks at four |
| **EEF, *Improving Mathematics in the Early Years and Key Stage 1*** (guidance report) | evidence synthesis, ages 3–7 | Five recommendations: practitioners' understanding of how children learn maths; dedicated maths time integrated through the day; manipulatives and representations; build on what children already know; high-quality targeted support |
| **Kim, Gilbert et al. (2021), *Measures matter: a meta-analysis of the effects of educational apps on preschool to Grade 3 children's literacy and math skills*** (CEPR) | meta-analysis, 36 studies / 285 effect sizes | ≈ **+0.31 SD** overall; larger for preschool than K–3; effects inflate with researcher-made measures |
| **Alotaibi (2024), *Game-based learning in early childhood education: a systematic review and meta-analysis***, Frontiers in Psychology 15 | meta-analysis | Educator-guided play and age-appropriate design as the moderators that matter |
| **NCCA Ireland, *Supporting inclusive practice when teaching Time*** (PDF) | official practitioner guidance | Concrete → Representational → Abstract: real clock first, then pictures/on-screen clocks, numerals last |

## Tier 3 — cited but not read in full

| Source | Kind | Used for | Caveat |
| --- | --- | --- | --- |
| **Williams (2012), *Image Schemas in Clock-Reading: Latent Errors and Emerging Expertise*, J. Learning Sciences 21(2)** | peer-reviewed | Prevalence by age: ~10% at four, 45% at five, all by seven, nearest-minute by ten | Taken from MacDonald & Murphy's summary of a three-study synthesis, not read in full. Quote it as "reported in", not as first-hand |
| **Burny, Valcke & Desoete (2009), *Towards an agenda for studying learning and instruction focusing on time-related competences in children*, Educational Studies 35(5):481–492** | peer-reviewed | Clock reading as "the most exclusive time-related subject in primary school"; nearest-minute by ~10; thin evidence base for instruction | Read via MacDonald & Murphy and the 2013 paper's citations |
| **Friedman (1978, 1986), *Development of time concepts in children*** | peer-reviewed, classic | Succession and duration judgements unstable to about 8; children misled by speed and distance | Known through secondary summaries; the direction of the finding is uncontroversial, the precise ages are old |

## Deliberately not used

| Source | Why not |
| --- | --- |
| Commercial "telling time workbook" pages, Instagram reels, YouTube "clock game" videos | Marketing; they restate the same ladder without evidence, and several state ages that contradict the curricula |
| Parenting blogs quoting "a 2018 University of Plymouth study" on analogue clocks and number sense | The study could not be located or verified. Do not repeat the claim |
| Off-the-shelf telling-time apps (Interactive Telling Time, Telling Time Academy, Clockworks, Topmarks/MathsFrame) | Useful to *play* — they are worth ten minutes of comparison before the spec — but they are the competition, and their level structures are not documented. See the note below |

## Note on the existing apps

Worth trying before the spec, because they will shape what feels familiar to him: **Topmarks
Teaching Clock** (open-ended, hands toggleable — the closest to the "hour hand only" idea),
**Toy Theater Interactive Clock** (hands can be turned off, 5-minute marks toggleable), **MathsFrame
Telling the Time** (untimed mode, selectable precision), **ABCya Time Travel** and **Mr. Nussbaum
Clockworks** (both gamified and both speed-based, which is the thing this design rejects).

None of them tiers by *representation*; they tier by answer precision. That is the gap this build
fills, and it is the reason to build rather than to use one.

## Verification state

- EDB primary and kindergarten PDFs: **downloaded and parsed**; quotes are exact.
- NCETM Y1 and Y2 Time pages: **read in full**.
- Third Space Learning article: **read in full**.
- MacDonald & Murphy 2020: **read in full** (preprint PDF from the CSU repository).
- Burny et al. 2013: **abstract only** (paywalled full text); the 11,743 figure and the two-year
  claim are from the published abstract.
- Marble taxonomy: **local clone**, `manifest.json` dated 2026-10-21, values read programmatically.
- Tillman & Barner: **abstract and introduction**, OSF preprint.
- Kim et al. 2021 and Alotaibi 2024: **abstracts and the reported meta-analytic summaries**; the
  +0.31 SD figure is Kim et al.'s own headline.
