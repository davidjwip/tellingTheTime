import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LEVELS } from '../src/levels';
import { createShell } from '../src/shell';

import type { Speaker } from '../src/audio';

class MemoryStore {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

let app: HTMLElement;
let overlayRoot: HTMLElement;
let store: MemoryStore;

beforeEach(() => {
  document.body.replaceChildren();
  app = document.createElement('div');
  overlayRoot = document.createElement('div');
  document.body.append(app, overlayRoot);
  store = new MemoryStore();
});

const shell = () => createShell({ app, overlayRoot, store, levels: LEVELS });

const click = (selector: string, x = 120, y = 300): void => {
  const target = document.querySelector(selector);
  if (!target) throw new Error(`nothing to click: ${selector}`);
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
};

const saved = () => JSON.parse(store.getItem('clock.v1.progress') ?? '{}') as Record<string, unknown>;

describe('the shell decides what a click means', () => {
  it('opens the shelf on a first visit', () => {
    shell().start(null);
    expect(app.querySelector('.picker')).not.toBeNull();
    expect(app.querySelector('.container.picker')).not.toBeNull();
  });

  it('honours a level in the URL, and refuses one the shelf will not offer', () => {
    shell().start('t0.1');
    expect(app.textContent).toContain('Put the day in order');

    document.body.replaceChildren();
    app = document.createElement('div');
    overlayRoot = document.createElement('div');
    document.body.append(app, overlayRoot);
    shell().start('t1.4'); // needs a screen that does not exist
    expect(app.querySelector('.picker')).not.toBeNull();
  });

  it('opens a tier from the shelf as a tier round, and remembers its door', () => {
    shell().start(null);
    const door = app.querySelector<HTMLElement>('section[data-tier="0"] [data-tier-entry]');
    expect(door, 'tier 0 should have a door').not.toBeNull();
    door?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 300 }));

    // the door is labelled by its tier, and the round behind it draws from the whole tier
    expect(app.querySelector('.picker')).toBeNull();
    expect(app.querySelector('.problem-area')).not.toBeNull();
    expect(saved().lastLevel).toBe(door?.dataset.level);
  });

  it('hands the round the app speaker when there is one', () => {
    const spoken: string[] = [];
    const speaker = {
      say: (key: string) => {
        spoken.push(key);
        return Promise.resolve();
      },
      setLocale: () => undefined,
    } as unknown as Speaker;

    const fresh = createShell({ app, overlayRoot, store, levels: LEVELS, speaker });
    fresh.start('t0.1');
    expect(app.querySelector('.problem-area')).not.toBeNull();
  });

  it('opens the parent instructions, and closes them on Close and on Escape', () => {
    shell().start(null);
    click('[data-action="instructions"]');
    expect(overlayRoot.querySelector('[data-action="close-instructions"]')).not.toBeNull();

    click('[data-action="close-instructions"]');
    expect(overlayRoot.textContent).toBe('');

    click('[data-action="instructions"]');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.textContent).not.toContain('ten right answers');
  });

  it('ignores clicks and keys that belong to nothing', () => {
    shell().start(null);
    const stray = document.createElement('span');
    overlayRoot.append(stray);
    stray.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(app.querySelector('.picker')).not.toBeNull();
  });

  it('reveals a tier\'s exercises on a long press, and does not start the round', () => {
    vi.useFakeTimers();
    try {
      shell().start(null);
      const door = app.querySelector<HTMLElement>('[data-tier-entry]')!;

      door.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      vi.advanceTimersByTime(450);
      expect(door.dataset.tip).toBe('true');

      // the press that revealed the tooltip must not also open the tier
      door.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 40, clientY: 300 }));
      expect(app.querySelector('.picker')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('dismisses the bubble on its own when the finger simply lifts', () => {
    vi.useFakeTimers();
    try {
      shell().start(null);
      const door = app.querySelector<HTMLElement>('[data-tier-entry]')!;
      door.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 40, clientY: 40 }));
      vi.advanceTimersByTime(450);
      expect(door.dataset.tip).toBe('true');

      // the finger lifts and nothing else happens: no click, no second tap, no stuck bubble
      door.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      vi.advanceTimersByTime(5200);
      expect(door.dataset.tip).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats a press that moves as a scroll, not a long press', () => {
    vi.useFakeTimers();
    try {
      shell().start(null);
      const door = app.querySelector<HTMLElement>('[data-tier-entry]')!;
      door.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 40, clientY: 40 }));
      door.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 40, clientY: 90 }));
      vi.advanceTimersByTime(450);
      expect(door.dataset.tip).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('dismisses the bubble when something else is tapped', () => {
    vi.useFakeTimers();
    try {
      shell().start(null);
      const door = app.querySelector<HTMLElement>('[data-tier-entry]')!;
      door.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 40, clientY: 40 }));
      vi.advanceTimersByTime(450);
      expect(door.dataset.tip).toBe('true');

      click('#child-name');
      expect(door.dataset.tip).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads a sample time out loud from the panel, in whichever register is chosen', () => {
    const said: string[] = [];
    const speaker = {
      say: (key: string) => {
        said.push(key);
        return Promise.resolve();
      },
      setLocale: () => undefined,
    } as unknown as Speaker;
    const fresh = createShell({ app, overlayRoot, store, levels: LEVELS, speaker });
    fresh.start(null);

    click('[data-action="instructions"]');
    click('[data-say="qpast-3"]');
    expect(said).toContain('qpast-3');
  });

  it('puts focus in the panel, and gives it back to the control that opened it', () => {
    shell().start(null);
    const opener = app.querySelector<HTMLElement>('[data-action="instructions"]')!;
    click('[data-action="instructions"]');
    expect(document.activeElement?.getAttribute('data-action')).toBe('close-instructions');

    click('[data-action="close-instructions"]');
    expect(document.activeElement).toBe(opener);
  });

  it('returns to the shelf from a tier round', () => {
    shell().start(null);
    app.querySelector<HTMLElement>('section[data-tier="2"] [data-tier-entry]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 300 }));
    click('[data-action="level"]');
    expect(app.querySelector('.picker')).not.toBeNull();
  });

  it('does nothing for a door whose tier has no playable bank', () => {
    shell().start(null);
    const section = document.createElement('section');
    section.dataset.tier = '6'; // tier 6 does not exist
    const door = document.createElement('button');
    door.dataset.tierEntry = 'true';
    door.dataset.level = 't6.1';
    section.append(door);
    app.querySelector('.picker')?.append(section);
    door.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 60, clientY: 60 }));
    expect(app.querySelector('.picker')).not.toBeNull();
  });

  it('treats a door outside a tier section as a plain level', () => {
    shell().start(null);
    const stray = document.createElement('button');
    stray.dataset.tierEntry = 'true';
    stray.dataset.level = 't0.4';
    app.querySelector('.picker')?.append(stray);
    stray.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 60, clientY: 60 }));
    expect(app.textContent).toContain('Days of the week');
  });

  it('keeps a ?level= deep link on one level, whatever the shelf looks like', () => {
    shell().start('t0.4');
    expect(app.textContent).toContain('Days of the week');
    expect(saved().lastLevel).toBe('t0.4');
  });

  it('does not rebuild the round when a card inside it is tapped', () => {
    // the production bug: the play container carries data-level, so a bare level lookup matched every
    // tap inside a round and started the level again, wiping what the child had placed
    shell().start('t0.1');
    click('[data-card]');
    expect(app.querySelectorAll('.order-slot [data-card]')).toHaveLength(1);

    click('[data-card]', 400, 500);
    expect(app.querySelectorAll('.order-slot [data-card]')).toHaveLength(2);
  });

  it('keeps the round when the language changes mid-round, and persists the choice', () => {
    shell().start('t0.1');
    click('[data-card]');
    expect(app.querySelectorAll('.order-slot [data-card]')).toHaveLength(1);

    click('[data-locale="yue"]');
    expect(app.querySelectorAll('.order-slot [data-card]')).toHaveLength(1);
    expect(saved().locale).toBe('yue');
  });

  it('remembers the language chosen on the shelf too', () => {
    shell().start(null);
    click('[data-locale="yue"]');
    expect(saved().locale).toBe('yue');
    expect(app.querySelector('.picker')).not.toBeNull(); // and stays on the shelf
  });

  it('starts a playable level from the Start button, never a shelved one', () => {
    store.setItem('clock.v1.progress', JSON.stringify({ lastLevel: 't1.4', locale: 'en' }));
    const fresh = shell();
    fresh.start(null);
    click('[data-action="start"]');
    // t1.4 needs a screen that does not exist, so Start must fall through to something playable
    expect(app.querySelector('.picker')).toBeNull();
    expect(fresh.currentLevel()?.id).not.toBe('t1.4');
  });

  it('ignores a shelf button naming a level that does not exist', () => {
    shell().start(null);
    const bogus = document.createElement('button');
    bogus.dataset.level = 'nope';
    app.querySelector('.picker')?.append(bogus);
    bogus.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 40, clientY: 40 }));
    expect(app.querySelector('.picker')).not.toBeNull();
    expect(saved().lastLevel).toBeUndefined();
  });

  it('exposes its progress, and returns to the shelf from the Level button', () => {
    const fresh = shell();
    fresh.start('t0.1');
    expect(fresh.progress().lastLevel).toBe('t0.1');

    click('[data-action="level"]'); // the play header's button, wired through onChangeLevel
    expect(app.querySelector('.picker')).not.toBeNull();
  });

  it('records a cleared level in storage when the round is finished', () => {
    const fresh = shell();
    fresh.start('t2.4'); // ten reading questions, all answerable
    for (let i = 0; i < 10; i += 1) click('[data-verdict="correct"]', 120 + i * 60, 300);

    expect(saved().cleared).toContain('t2.4');
  });

  it('does not hear from inputs that are not the name field', () => {
    shell().start(null);
    const other = document.createElement('input');
    other.name = 'something-else';
    app.append(other);
    other.value = 'x';
    other.dispatchEvent(new Event('input', { bubbles: true }));
    expect(saved().name).toBeUndefined(); // nothing was written at all
  });

  it('remembers the name the adult types, and ignores other fields', () => {
    shell().start(null);
    const input = app.querySelector('#child-name') as HTMLInputElement;
    input.value = '  Sam  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(saved().name).toBe('Sam');
  });
});
