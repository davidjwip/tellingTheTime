import { describe, expect, it } from 'vitest';

import { LEVELS } from '../src/levels';
import { levelFromClick, renderPicker, resolveStartLevel, shelve } from '../src/picker';
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
    expect(shelve([level('t1.1')], DEFAULT_PROGRESS)[0]?.reason).toMatch(/tap/i);
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

describe('the shelf', () => {
  const shelved = shelve(LEVELS, DEFAULT_PROGRESS);

  it('is a screen, not a list: one section per tier, in order', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    const tiers = [...screen.querySelectorAll('[data-tier]')].map((n) => n.getAttribute('data-tier'));
    expect(tiers).toEqual(['0', '1', '2', '3', '4']);
  });

  it('gives every level a button carrying its id', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    const ids = [...screen.querySelectorAll('[data-level]')].map((n) => n.getAttribute('data-level'));
    expect(ids).toEqual(LEVELS.map((l) => l.id));
  });

  it('disables what cannot be played, and says why in the button', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    const blocked = screen.querySelector('[data-level="t2.3"]') as HTMLButtonElement;
    expect(blocked.disabled).toBe(true);
    expect(blocked.textContent).toMatch(/dragg/i);
  });

  it('leaves the playable ones enabled', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    expect((screen.querySelector('[data-level="t2.4"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('leaves the two order levels enabled now their screen exists', () => {
    const screen = renderPicker(
      shelve([level('t0.1'), level('t0.4')], DEFAULT_PROGRESS),
      DEFAULT_PROGRESS,
    );
    expect((screen.querySelector('[data-level="t0.1"]') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.querySelector('[data-level="t0.4"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('marks a cleared level without hiding it', () => {
    const progress = { ...DEFAULT_PROGRESS, cleared: ['t2.4'] };
    const screen = renderPicker(shelve(LEVELS, progress), progress);
    const cleared = screen.querySelector('[data-level="t2.4"]');
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

  it('still shows a cleared level that is not playable yet', () => {
    // cleared and unavailable: the tick wins, because it happened
    const progress = { ...DEFAULT_PROGRESS, cleared: ['t2.3'] };
    const screen = renderPicker(shelve(LEVELS, progress), progress);
    const button = screen.querySelector('[data-level="t2.3"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.level-note')?.textContent).toBe('✓');
  });

  it('says so when a level has too few questions and nothing to blame', () => {
    const thin: Level = {
      ...level('t2.4'),
      id: 'test-thin',
      round: [{ task: 'read', items: 2 }],
    };
    const [shelved] = shelve([thin], DEFAULT_PROGRESS);
    expect(shelved?.available).toBe(false);
    expect(shelved?.reason).toBe('nothing to ask yet');
  });

  it('keeps the footer credit', () => {
    const screen = renderPicker(shelved, DEFAULT_PROGRESS);
    expect(screen.querySelector('footer')?.textContent).toContain('Created for George and Teddy Ip.');
  });
});