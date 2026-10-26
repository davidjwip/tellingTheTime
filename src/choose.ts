/**
 * The two pre-clock `choose` levels: cards, not a dial.
 *
 * A choice is checkable, unlike a read question, so the app marks it. The card tables live here
 * rather than in levels.json because they are content the child sees, and the level file names only
 * the kind. Keeping them in one place means the emoji, the word and the correct card cannot drift
 * apart between the question table and the screen.
 */

import { chronoKeyFor } from './audio';
import { el, feedbackArea } from './dom';
import { renderFace } from './clockFace';

import type { ClockTime, Item } from './engine';
import type { Content, Face, Level } from './types';

/** The face a clock choice is drawn with when the caller has none to hand. */
const DEFAULT_FACE: Face = {
  hands: 'both',
  minuteHandParked: false,
  numerals: true,
  minuteMarks: false,
  minuteLabels: false,
  pastToShade: false,
  showDigital: false,
};

/** The hours as a child hears them. `0` and `12` are both the twelve. */
export const WORDS: Record<number, string> = {
  0: 'twelve',
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
  12: 'twelve',
};

/**
 * The minutes this screen can say out loud.
 *
 * Five-minute grids are deliberately absent: "twenty-five to five" needs a phrase the app does not
 * have yet, and a question phrased wrongly is worse than no question.
 */
const MINUTE_WORDS: Record<number, string> = {
  0: "o'clock",
  15: 'quarter past',
  30: 'half past',
  45: 'quarter to',
};

/** How a clock is said: `3:45` is quarter to *four*. */

export function phraseFor(time: ClockTime): string | undefined {
  const minutes = MINUTE_WORDS[time.minute];
  if (minutes === undefined) return undefined;
  if (time.minute === 0) return `${WORDS[time.hour % 12]} o'clock`;
  if (time.minute === 45) return `quarter to ${WORDS[(time.hour % 12) + 1]}`;
  return `${minutes} ${WORDS[time.hour % 12]}`;
}

export interface Card {
  id: string;
  emoji: string;
  word: string;
}

export interface Choice {
  cards: Card[];
  answer: string;
  question: string;
  /** Present for a clock choice: two faces that differ only in the minutes. */
  dials?: ClockTime[];
  /** Present for a numeral choice: the numbers to pick between. */
  numbers?: string[];
  /** The hour the question starts from, drawn highlighted on the face. */
  from?: number;
  /** The clip that says this question out loud, where the question is a time. */
  say?: string;
}

const DAY_CARDS: Card[] = [
  { id: 'yesterday', emoji: '⬅️', word: 'Yesterday' },
  { id: 'today', emoji: '☀️', word: 'Today' },
  { id: 'tomorrow', emoji: '➡️', word: 'Tomorrow' },
];

const DAY_ORDER = DAY_CARDS.map((card) => card.id);

interface DurationPair {
  cards: [Card, Card];
  answer: string;
}

const DURATION_PAIRS: DurationPair[] = [
  {
    cards: [
      { id: 'bath', emoji: '🛁', word: 'A bath' },
      { id: 'nap', emoji: '😴', word: 'A nap' },
    ],
    answer: 'nap',
  },
  {
    cards: [
      { id: 'brushing-teeth', emoji: '🪥', word: 'Brushing teeth' },
      { id: 'cartoon', emoji: '📺', word: 'A cartoon' },
    ],
    answer: 'cartoon',
  },
  {
    cards: [
      { id: 'blink', emoji: '👁️', word: 'A blink' },
      { id: 'song', emoji: '🎵', word: 'A song' },
    ],
    answer: 'song',
  },
  {
    cards: [
      { id: 'snack', emoji: '🍎', word: 'A snack' },
      { id: 'night-sleep', emoji: '🛏️', word: "A night's sleep" },
    ],
    answer: 'night-sleep',
  },
  {
    cards: [
      { id: 'bus-ride', emoji: '🚌', word: 'A bus ride' },
      { id: 'socks', emoji: '🧦', word: 'Putting on socks' },
    ],
    answer: 'bus-ride',
  },
  {
    cards: [
      { id: 'rice', emoji: '🍚', word: 'Eating rice' },
      { id: 'teeth', emoji: '🦷', word: 'Brushing teeth' },
    ],
    answer: 'rice',
  },
];

/**
 * The next question in a fixed cycle.
 *
 * The previous answer is passed in rather than remembered in a module variable: the round owns the
 * no-repeat window, exactly as it does for clock times, so two sessions cannot tread on each other.
 * An unknown previous starts at the beginning instead of throwing.
 */
function nextIndex(previous: string | undefined, order: readonly string[]): number {
  const at = previous === undefined ? -1 : order.indexOf(previous);
  return (at + 1) % order.length;
}

function randomIndex(rng: () => number, length: number): number {
  return Math.min(Math.floor(rng() * length), length - 1);
}

/**
 * The cards for one choose item, or undefined when this content has no card table.
 *
 * Duration pairs are drawn from `rng` and the two cards are swapped by it too, so neither the
 * position nor the sequence gives the answer away. The pair table and the answer id never change:
 * only the order on screen does. The day strip keeps its fixed three-card order because the question
 * names the card it wants.
 */
export function chooseFor(
  content: Content,
  previous?: string,
  rng: () => number = Math.random,
): Choice | undefined {
  if (content.kind === 'dayStrip') {
    const answer = DAY_ORDER[nextIndex(previous, DAY_ORDER)] as string;
    const word = DAY_CARDS.find((card) => card.id === answer)!.word;
    return {
      cards: DAY_CARDS.map((card) => ({ ...card })),
      answer,
      question: `Which one is ${word.toLowerCase()}?`,
    };
  }

  if (content.kind === 'durationPair') {
    const candidates =
      previous === undefined
        ? DURATION_PAIRS
        : DURATION_PAIRS.filter((pair) => pair.answer !== previous);
    const pool = candidates.length > 0 ? candidates : DURATION_PAIRS;
    const pair = pool[randomIndex(rng, pool.length)]!;
    const swapped = rng() > 0.5;
    const cards = swapped ? [pair.cards[1], pair.cards[0]] : [...pair.cards];

    return {
      cards: cards.map((card) => ({ ...card })),
      answer: pair.answer,
      question: 'Which took longer?',
    };
  }

  return undefined;
}

/**
 * The choose screen: prompt, cards, feedback.
 *
 * The visible card is the emoji with its word underneath. The accessible name is the word on its
 * own, so a screen reader does not announce an emoji the child is expected to recognise by sight.
 */
/**
 * A choice between two clocks.
 *
 * The hour is held fixed on purpose: with the same hour on both faces the only thing that can
 * separate them is the minute hand, which is the one idea these two levels exist to teach.
 */
export function choiceFor(
  level: Level,
  previous?: string,
  rng: () => number = Math.random,
): Choice | undefined {
  if (level.content.kind !== 'clock') return chooseFor(level.content, previous, rng);

  const minutes = level.minutes ?? [];
  if (minutes.length < 2) return undefined; // nothing to choose between
  if (minutes.some((minute) => MINUTE_WORDS[minute] === undefined)) return undefined; // no words yet
  const hours = level.hours ?? [];
  if (hours.length === 0) return undefined;

  // Lazily: the loop may hit `previous` eight times in a row on a level with hours [3] and
  // minutes [0, 30]. The caller is promised a choice or a refusal, never an undefined that a `!`
  // would then trust.
  let hour = hours[Math.floor(rng() * hours.length)] as number;
  let answerMinute = minutes[Math.floor(rng() * minutes.length)] as number;
  for (let attempt = 0; attempt < 8 && `${hour}:${answerMinute}` === previous; attempt += 1) {
    hour = hours[Math.floor(rng() * hours.length)] as number;
    answerMinute = minutes[Math.floor(rng() * minutes.length)] as number;
  }
  if (`${hour}:${answerMinute}` === previous) {
    // every draw landed on the same answer: take the other minute, which always exists here
    answerMinute = (minutes.find((minute) => minute !== answerMinute) ?? answerMinute) as number;
  }

  {
    const key = `${hour}:${answerMinute}`;
    const others = minutes.filter((minute) => minute !== answerMinute);
    const distractorMinute = others[Math.floor(rng() * others.length)] as number;
    const answer = { hour, minute: answerMinute };
    const distractor = { hour, minute: distractorMinute };
    const dials = rng() < 0.5 ? [answer, distractor] : [distractor, answer];

    const choice: Choice = {
      cards: [],
      answer: key,
      question: `Which one is ${phraseFor(answer)}?`,
      dials,
    };
    // the audio for the question is the time itself: a child who cannot read the prompt must still
    // be asked something, and "half past three" is the question
    const say = chronoKeyFor(answer);
    if (say) choice.say = say;
    return choice;
  }
}

/**
 * "After twelve comes…?"
 *
 * The distractor is the hour BEFORE, never a random number: the mistake this level exists to catch is
 * counting backwards, or saying thirteen because arithmetic says twelve plus one. Thirteen is kept for
 * exactly the one question where it is the answer a child would reach for.
 */
export function wrapChoiceFor(
  level: Level,
  previous?: string,
  rng: () => number = Math.random,
): Choice | undefined {
  if (level.content.kind !== 'wrap') return undefined;

  let from = Math.floor(rng() * 12) + 1;
  // the answer is the hour after, so a repeat of the previous answer is a repeat of the question
  for (let attempt = 0; attempt < 8 && String((from % 12) + 1) === previous; attempt += 1) {
    from = Math.floor(rng() * 12) + 1;
  }
  const answer = (from % 12) + 1;
  if (String(answer) === previous) from = (from % 12) + 1; // step on once, so the answer differs
  const settled = (from % 12) + 1;

  const distractor = from === 12 ? 13 : from === 1 ? 12 : from - 1;
  const numbers = rng() < 0.5 ? [String(settled), String(distractor)] : [String(distractor), String(settled)];

  return {
    cards: [],
    answer: String(settled),
    question: `After ${WORDS[from]} comes…?`,
    numbers,
    from,
    say: `after-${from}`,
  };
}

export function renderChoose(
  item: Item,
  lastVerdict?: 'correct' | 'wrong',
  face: Face = DEFAULT_FACE,
): HTMLElement {
  const wrapper = el('div', 'choose');
  wrapper.append(el('div', 'prompt', item.question ?? ''));

  if (item.numbers && item.numbers.length > 0) {
    if (item.from !== undefined) {
      const frame = el('div', 'clock-frame wrap-frame');
      // a face with no hands: the question is about the numerals going round, not about a time
      frame.append(
        renderFace({ hour: 12, minute: 0 }, {
          hands: 'none',
          minuteHandParked: false,
          numerals: true,
          minuteMarks: false,
          minuteLabels: false,
          pastToShade: false,
          showDigital: false,
        }),
      );
      // mark the hour the question starts from, so the child can see where the counting begins
      const marked = frame.querySelector<SVGElement>(`[data-numeral="${item.from}"]`);
      if (marked) {
        marked.dataset.from = String(item.from);
        marked.classList.add('from-numeral');
      }
      wrapper.append(frame);
    }

    const row = el('div', 'choice-numbers');
    for (const number of item.numbers) {
      const button = el('button', 'choice-number');
      button.type = 'button';
      button.dataset.choice = number;
      button.textContent = number;
      row.append(button);
    }
    wrapper.append(row, feedbackArea(lastVerdict));
    return wrapper;
  }

  if (item.dials && item.dials.length > 0) {
    const row = el('div', 'choice-dials');
    for (const time of item.dials) {
      const button = el('button', 'choice-dial');
      button.type = 'button';
      button.dataset.choice = `${time.hour}:${time.minute}`;
      button.append(renderFace(time, face));
      row.append(button);
    }
    wrapper.append(row, feedbackArea(lastVerdict));
    return wrapper;
  }

  const cards = el('div', 'choice-cards');
  for (const card of item.cards ?? []) {
    const button = el('button', 'choice-card');
    button.type = 'button';
    button.dataset.choice = card.id;
    button.setAttribute('aria-label', card.word);

    const emoji = el('span', 'choice-emoji', card.emoji);
    emoji.setAttribute('aria-hidden', 'true');
    button.append(emoji, el('span', 'choice-word', card.word));
    cards.append(button);
  }
  wrapper.append(cards);

  wrapper.append(feedbackArea(lastVerdict));

  return wrapper;
}
