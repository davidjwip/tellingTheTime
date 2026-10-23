import { beforeEach, describe, expect, it } from 'vitest';

import { LEVELS } from '../src/levels';
import { createShell } from '../src/shell';

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
    shell().start('t1.1'); // needs tapping the dial: not playable
    expect(app.querySelector('.picker')).not.toBeNull();
  });

  it('opens a level from the shelf and remembers it', () => {
    shell().start(null);
    click('[data-level="t0.4"]');
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
    store.setItem('clock.v1.progress', JSON.stringify({ lastLevel: 't1.1', locale: 'en' }));
    const fresh = shell();
    fresh.start(null);
    click('[data-action="start"]');
    // t1.1 needs a screen that does not exist, so Start must fall through to something playable
    expect(app.querySelector('.picker')).toBeNull();
    expect(fresh.currentLevel()?.id).not.toBe('t1.1');
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

  it('remembers the name the adult types, and ignores other fields', () => {
    shell().start(null);
    const input = app.querySelector('#child-name') as HTMLInputElement;
    input.value = '  Sam  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(saved().name).toBe('Sam');
  });
});
