import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { LEVELS } from '../src/levels';
import {
  bankForTier,
  firstPlayable,
  levelFromClick,
  renderInstructions,
  renderPicker,
  resolveStartLevel,
  shelve,
  TIER_TITLES,
} from '../src/picker';
import { DEFAULT_PROGRESS } from '../src/progress';

import type { Level } from '../src/types';

const level = (id: string): Level => {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`no level ${id}`);
  return found;
};

describe('which levels can be played today', () => {
  it('offers a level whose round is entirely answerable', () => {
    const [shelved] = shelve([level('t2.4')], DEFAULT_PROGRESS); // ten reading questions
    expect(shelved?.available).toBe(true);
    expect(shelved?.reason).toBeUndefined();
    expect(shelved?.items).toBe(10);
  });

  it('drops the questions the app cannot ask yet, and says how many are left', () => {
    const [shelved] = shelve([level('t2.2')], DEFAULT_PROGRESS); // six reads, four sets
    expect(shelved?.items).toBe(6);
    expect(shelved?.available).toBe(true);
  });

  it('marks a level unavailable when too little is left to be worth a round', () => {
    const [shelved] = shelve([level('t2.3')], DEFAULT_PROGRESS); // three reads, seven sets
    expect(shelved?.items).toBe(3);
    expect(shelved?.available).toBe(false);
    expect(shelved?.reason).toMatch(/dragg/i);
  });

  it('names what the unanswerable questions need, so the shelf is a to-do list', () => {
    expect(shelve([level('t1.1')], DEFAULT_PROGRESS)[0]?.available).toBe(true); // the dial can be tapped now
    expect(shelve([level('t1.2')], DEFAULT_PROGRESS)[0]?.reason).toMatch(/choos/i);
    expect(shelve([level('t1.4')], DEFAULT_PROGRESS)[0]?.reason).toMatch(/build/i);

    // an order step with no order table still says what it is waiting for
    const noOrderTable: Level = {
      ...level('t0.1'),
      id: 'test-order-no-table',
      content: { kind: 'clock' },
      hours: [1],
      minutes: [0],
    };
    expect(shelve([noOrderTable], DEFAULT_PROGRESS)[0]?.reason).toMatch(/ordering/i);
  });

  it('offers the two choose levels now that their screen exists', () => {
    const [yesterday] = shelve([level('t0.2')], DEFAULT_PROGRESS);
    expect(yesterday?.available).toBe(true);
    expect(yesterday?.items).toBe(6);
    expect(yesterday?.reason).toBeUndefined();

    const [duration] = shelve([level('t0.3')], DEFAULT_PROGRESS);
    expect(duration?.available).toBe(true);
    expect(duration?.items).toBe(8);
    expect(duration?.reason).toBeUndefined();
  });

  it('offers the two order levels now that their screen exists', () => {
    const [day] = shelve([level('t0.1')], DEFAULT_PROGRESS);
    expect(day?.available).toBe(true);
    expect(day?.items).toBe(6);
    expect(day?.reason).toBeUndefined();

    const [week] = shelve([level('t0.4')], DEFAULT_PROGRESS);
    expect(week?.available).toBe(true);
    expect(week?.items).toBe(4);
    expect(week?.reason).toBeUndefined();
  });

  it('still says the choosing levels with no cards need choosing', () => {
    expect(shelve([level('t1.2')], DEFAULT_PROGRESS)[0]?.reason).toMatch(/choos/i);
    expect(shelve([level('t3.1')], DEFAULT_PROGRESS)[0]?.reason).toMatch(/choos/i);
  });

  it('knows which levels have already been cleared', () => {
    const [shelved] = shelve([level('t2.4')], { ...DEFAULT_PROGRESS, cleared: ['t2.4'] });
    expect(shelved?.cleared).toBe(true);
  });
});

describe('where a visit starts', () => {
  const progress = { ...DEFAULT_PROGRESS, lastLevel: 't2.4' };

  it('resumes the remembered level when it is playable', () => {
    expect(resolveStartLevel(LEVELS, progress, null)?.id).toBe('t2.4');
  });

  it('honours a level in the URL', () => {
    expect(resolveStartLevel(LEVELS, DEFAULT_PROGRESS, 't3.4')?.id).toBe('t3.4');
  });

  it('refuses a level that cannot be played, however it was asked for', () => {
    // both are untrusted input, and both used to start a round of nothing
    expect(resolveStartLevel(LEVELS, DEFAULT_PROGRESS, 't2.3')).toBeNull();
    expect(resolveStartLevel(LEVELS, { ...DEFAULT_PROGRESS, lastLevel: 't1.4' }, null)).toBeNull();
  });

  it('refuses a level that does not exist', () => {
    expect(resolveStartLevel(LEVELS, DEFAULT_PROGRESS, 'nope')).toBeNull();
  });

  it('has nothing to resume on a first visit', () => {
    expect(resolveStartLevel(LEVELS, DEFAULT_PROGRESS, null)).toBeNull();
  });
});

describe('which click means a level', () => {
  const build = () => {
    document.body.replaceChildren();
    const picker = document.createElement('div');
    picker.className = 'container picker';
    const button = document.createElement('button');
    button.dataset.level = 't0.4';
    picker.append(button);

    // the play screen's container carries data-level too - that is what made every tap a remount
    const playing = document.createElement('div');
    playing.className = 'container';
    playing.dataset.level = 't0.1';
    const card = document.createElement('button');
    card.dataset.card = 'morning';
    playing.append(card);

    document.body.append(picker, playing);
    return { button, card };
  };

  it('reads a level from a shelf button', () => {
    expect(levelFromClick(build().button)).toBe('t0.4');
  });

  it('ignores a tap inside a round, even though the screen carries data-level', () => {
    expect(levelFromClick(build().card)).toBeNull();
  });

  it('ignores a tap on nothing', () => {
    expect(levelFromClick(null)).toBeNull();
  });
});

describe('where Start goes', () => {
  it('falls back to the first playable level when the remembered one is shelved', () => {
    const remembered = { ...DEFAULT_PROGRESS, lastLevel: 't1.4' }; // needs a screen that does not exist
    expect(firstPlayable(LEVELS, remembered)?.id).toBe('t0.1');
  });
});

describe('the language control in the stylesheet', () => {
  it('never paints an option the colour this app uses for a wrong answer', () => {
    // happy-dom gives import.meta.url an http scheme, so resolve from the repo root instead
    const css = readFileSync('src/styles.css', 'utf8');
    const blocks = [...css.matchAll(/\.operator-toggle[^{]*\{[^}]*\}/g)].map((m) => m[0]);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.toLowerCase()).not.toContain('#ff6b6b');
      expect(block).not.toContain('255, 107, 107');
    }
  });

  it('makes a level a pill, not a bar across the window', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    const block = css.match(/\.level-btn \{[^}]*\}/)?.[0];
    expect(block, '.level-btn must have rules of its own').toBeDefined();
    // a rounded end is a rounded end: 50px, 999px and 50% all do the job
    const radius = block?.match(/border-radius:\s*([^;]+);/)?.[1]?.trim() ?? '';
    const px = Number.parseFloat(radius);
    const rounded = radius.endsWith('%') ? px >= 40 : px >= 40;
    expect(rounded, `border-radius was ${radius}`).toBe(true);
    expect(block).not.toContain('width: 100%');
  });

  it('gives the name field the toolbar treatment the label implies', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    const block = css.match(/\.picker \.name-input \{[^}]*\}/)?.[0];
    expect(block, '.name-input had no rules at all').toBeDefined();
    const minHeight = Number.parseFloat(block?.match(/min-height:\s*(\d+)px/)?.[1] ?? '0');
    expect(minHeight, 'a field a thumb has to hit is at least 44px').toBeGreaterThanOrEqual(44);
  });

  it('keeps Instructions quiet, so it does not shout over the levels', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    const block = css.match(/\[data-action='instructions'\] \{[^}]*\}/)?.[0];
    expect(block, 'Instructions must be styled as a setting').toBeDefined();
    expect(block?.toLowerCase()).not.toContain('#ff6b6b');
  });

  it('reserves solid green for Start, so "press the green one" has one answer', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    const chosen = css.match(/\.operator-active,[^{]*\{[^}]*\}/)?.[0] ?? '';
    const background = chosen.match(/background-color:\s*([^;]+);/)?.[1]?.trim();
    // the chosen language is green, but a soft green: Start is the only solid accent on the screen
    expect(background).toBe('#d3f2ee');
  });
});

describe('the shelf', () => {
  const shelved = shelve(LEVELS, DEFAULT_PROGRESS);

  const entries = (screen: HTMLElement): HTMLElement[] => [
    ...screen.querySelectorAll<HTMLElement>('.picker [data-level]'),
  ];

  const firstPlayable = (tier: number): Level => {
    const found = LEVELS.filter((l) => l.tier === tier).find(
      (l) => shelve([l], DEFAULT_PROGRESS)[0]?.available === true,
    );
    if (!found) throw new Error(`tier ${tier} has no playable level`);
    return found;
  };

  it('is a screen, not a list: one section per playable tier, in order', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    const tiers = [...screen.querySelectorAll('[data-tier]')].map((n) => n.getAttribute('data-tier'));
    // tier 1 has no playable exercise, so it has no door of its own
    expect(tiers).toEqual(['0', '1', '2', '3', '4', '5']);
  });

  it('gives each playable tier one entry carrying its first playable level', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    const ids = entries(screen).map((n) => n.dataset.level);
    expect(ids).toEqual(['t0.1', 't1.1', 't2.1', 't3.2', 't4.2', 't5.1']);
  });

  it('builds a tier bank from that tier plus every playable tier below it', () => {
    const bank = bankForTier(LEVELS, DEFAULT_PROGRESS, 3);
    expect(bank).not.toBeNull();
    expect(bank?.tier).toBe(3);
    expect(bank?.levels.every((l) => l.tier === 3)).toBe(true);
    expect(bank?.review.every((l) => l.tier < 3)).toBe(true);
    // tier 1 is playable now that the dial can be tapped, so it belongs in the revision pool
    expect(bank?.review.some((l) => l.tier === 1)).toBe(true);
  });

  it('draws five-minute revision from the tiers below it', () => {
    const bank = bankForTier(LEVELS, DEFAULT_PROGRESS, 5);
    expect(bank?.levels.map((l) => l.id)).toEqual(['t5.1', 't5.2']);
    expect(bank?.review.length).toBeGreaterThan(0);
    expect(bank?.review.every((l) => l.tier < 5)).toBe(true);
  });

  it('has no bank for a tier that cannot be played', () => {
    expect(bankForTier(LEVELS, DEFAULT_PROGRESS, 6)).toBeNull(); // tier 6 does not exist
  });

  it('makes the tier name itself the button, with no heading above it', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    for (const tier of [0, 2, 3, 4]) {
      const section = screen.querySelector(`section[data-tier="${tier}"]`);
      expect(section?.querySelector('h2'), `tier ${tier} heading`).toBeNull();
      expect(section?.querySelector('p'), `tier ${tier} description`).toBeNull();
      // the one control in the section is a button wearing the tier's name
      const controls = [...(section?.querySelectorAll('button') ?? [])];
      expect(controls, `tier ${tier} controls`).toHaveLength(1);
      expect(controls[0]?.textContent).toContain(TIER_TITLES[tier]);
    }
  });

  it('offers three registers, and calls the panel what a parent would call it', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    const codes = [...screen.querySelectorAll('[data-locale]')].map((n) => n.getAttribute('data-locale'));
    expect(codes).toEqual(['en', 'yue', 'zh']);
    expect(screen.querySelector('[data-action="instructions"]')?.textContent).toBe('How to use');
  });

  it('shows the sample words in the chosen register, not just a speaker icon', () => {
    expect(renderInstructions('zh').textContent).toContain('三時十五分');
    expect(renderInstructions('yue').textContent).toContain('三點三');
    expect(renderInstructions('en').textContent).toContain('quarter past three');
  });

  it('explains the spoken and written registers, and lets a parent hear both', () => {
    const panel = renderInstructions();
    const text = panel.textContent ?? '';
    expect(text).toContain('三點三');
    expect(text).toContain('三時十五分');
    const samples = [...panel.querySelectorAll('[data-say]')].map((n) => n.getAttribute('data-say'));
    expect(samples).toEqual(['oclock-3', 'qpast-3', 'qto-3']);
  });

  it('puts the language beside How to use, at the same size', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    const help = screen.querySelector('[data-action="instructions"]');
    const toggle = screen.querySelector('.operator-toggle');
    expect(toggle?.parentElement).toBe(help?.parentElement);
    expect(help?.classList.contains('small')).toBe(true);
    expect(screen.querySelector('[data-locale="en"]')?.classList.contains('small')).toBe(true);
    expect(screen.querySelector('[data-locale="yue"]')?.classList.contains('small')).toBe(true);
    expect(screen.querySelector('[data-locale="zh"]')?.classList.contains('small')).toBe(true);
  });

  it('does not tell the adult to choose a level', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    expect(screen.textContent).not.toContain('Choose a level');
  });

  it('sizes Start above the level buttons', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    expect(screen.querySelector('[data-action="start"]')?.classList.contains('start-primary')).toBe(true);
  });

  it('colours Start as the primary action, not a level', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    const start = screen.querySelector('[data-action="start"]');
    expect(start?.classList.contains('primary')).toBe(true);
  });

  it('marks only the chosen language, and never with an answer colour', () => {
    const yue = renderPicker(shelved, { ...DEFAULT_PROGRESS, locale: 'yue' });
    const chosen = yue.querySelector('[data-locale="yue"]');
    const other = yue.querySelector('[data-locale="en"]');
    expect(chosen?.classList.contains('operator-active')).toBe(true);
    expect(chosen?.getAttribute('aria-pressed')).toBe('true');
    expect(other?.classList.contains('operator-active')).toBe(false);
    expect(other?.getAttribute('aria-pressed')).toBe('false');
    // red means "wrong answer" in this app, so no language control may carry it
    for (const button of [chosen, other]) {
      expect(button?.className).not.toMatch(/wrong|red/);
    }
  });

  it('tells a parent what the app is, and what each tier teaches', () => {
    const panel = renderInstructions();
    const text = panel.textContent ?? '';
    for (const tier of [0, 2, 3, 4]) expect(text).toContain(TIER_TITLES[tier]);
    expect(text).toContain('ten right answers');
    expect(text.toLowerCase()).toContain('on this device');
    expect(panel.querySelector('[data-action="close-instructions"]')).not.toBeNull();
  });

  it('puts the panel body in a card, so the dimming layer can cover the screen', () => {
    const panel = renderInstructions();
    const card = panel.querySelector('.instructions-card');
    expect(card).not.toBeNull();
    expect(card?.querySelector('[data-action="close-instructions"]')).not.toBeNull();
    expect(card?.textContent).toContain('ten right answers');
  });

  it('keeps the exercises out of the buttons and inside the entry tooltip', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);

    for (const tier of [0, 2, 3, 4]) {
      const tierLevels = LEVELS.filter((l) => l.tier === tier);
      const entry = screen.querySelector<HTMLElement>(`[data-level="${firstPlayable(tier).id}"]`);
      const names = tierLevels.map((l) => l.title.en).join(', ');

      expect(entry, `tier ${tier}`).not.toBeNull();
      expect(entry?.title, `tier ${tier} title`).toBe(names);
      expect(entry?.getAttribute('aria-description'), `tier ${tier} description`).toBe(names);
    }
  });

  it('leaves the playable tier entries enabled', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    for (const entry of entries(screen)) {
      expect((entry as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it('marks a cleared tier entry without hiding it', () => {
    const progress = { ...DEFAULT_PROGRESS, cleared: ['t2.1'] };
    const screen = renderPicker(shelve(LEVELS, progress), progress);
    const cleared = screen.querySelector('[data-level="t2.1"]');
    expect(cleared?.getAttribute('data-cleared')).toBe('true');
    expect(cleared?.textContent).toContain('✓');
  });

  it('offers a name field holding what is already known', () => {
    const screen = renderPicker(shelved, { ...DEFAULT_PROGRESS, name: 'Sam' });
    const input = screen.querySelector('input[name="name"]') as HTMLInputElement;
    expect(input.value).toBe('Sam');
    expect(input.maxLength).toBe(20);
  });

  it('asks for a name with a plain label, and never requires one', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    // "Who is playing?" reads better to a parent than "Name", so the label says that; what matters
    // is that it is attached to the field and that the field is optional
    const label = screen.querySelector('label[for="child-name"]');
    expect(label?.textContent).toBe('Who is playing?');
    const input = screen.querySelector('#child-name') as HTMLInputElement;
    expect(input.required).toBe(false);
    expect((screen.querySelector('[data-action="start"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('leaves out a tier with nothing on it', () => {
    const onlyTierTwo = shelve([level('t2.4')], DEFAULT_PROGRESS);
    const screen = renderPicker(onlyTierTwo, DEFAULT_PROGRESS);
    expect([...screen.querySelectorAll('[data-tier]')].map((n) => n.getAttribute('data-tier'))).toEqual(['2']);
  });

  it('leaves out a tier whose only level cannot be played', () => {
    // A level with too few answerable questions is still shelved, but it is not a door
    const thin: Level = {
      ...level('t2.4'),
      id: 'test-thin',
      round: [{ task: 'read', items: 2 }],
    };
    const shelvedThin = shelve([thin], DEFAULT_PROGRESS)[0];
    if (!shelvedThin) throw new Error('thin level was not shelved');
    expect(shelvedThin.available).toBe(false);
    expect(shelvedThin.reason).toBe('nothing to ask yet');

    const screen = renderPicker([shelvedThin], DEFAULT_PROGRESS);
    expect(screen.querySelector('[data-tier="2"]')).toBeNull();
    expect(entries(screen)).toHaveLength(0);
  });

  it('offers the language before a level is chosen, marked with the saved choice', () => {
    const screen = renderPicker(shelved, { ...DEFAULT_PROGRESS, locale: 'yue' });
    expect(screen.querySelector('[data-locale="en"]')).not.toBeNull();
    expect(screen.querySelector('[data-locale="yue"]')?.classList.contains('operator-active')).toBe(true);
  });

  it('keeps the footer credit', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    expect(screen.querySelector('footer')?.textContent).toContain('Created for George and Teddy Ip.');
  });
});