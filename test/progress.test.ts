import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_PROGRESS,
  loadProgress,
  markCleared,
  rememberLevel,
  saveProgress,
  setName,
} from '../src/progress';

/** A stand-in for localStorage: the real one throws on private browsing and is not available in CI. */
class MemoryStore {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

let store: MemoryStore;

beforeEach(() => {
  store = new MemoryStore();
});

describe('what the app remembers', () => {
  // AC-32
  it('starts empty rather than undefined', () => {
    expect(loadProgress(store)).toEqual(DEFAULT_PROGRESS);
    expect(DEFAULT_PROGRESS.name).toBe('');
    expect(DEFAULT_PROGRESS.lastLevel).toBeNull();
    expect(DEFAULT_PROGRESS.cleared).toEqual([]);
  });

  it('survives a round trip', () => {
    const saved = { name: 'Sam', lastLevel: 't2.2', cleared: ['t2.1'], locale: 'yue' as const };
    saveProgress(store, saved);
    expect(loadProgress(store)).toEqual(saved);
  });

  it('falls back to defaults on junk, instead of throwing in a child\'s face', () => {
    store.setItem('clock.v1.progress', 'not json at all');
    expect(loadProgress(store)).toEqual(DEFAULT_PROGRESS);

    store.setItem('clock.v1.progress', '{"name":42,"cleared":"t2.1"}');
    const loaded = loadProgress(store);
    expect(loaded.name).toBe('');
    expect(loaded.cleared).toEqual([]);
  });

  it('keeps only the fields it knows, and only strings in the cleared list', () => {
    store.setItem(
      'clock.v1.progress',
      JSON.stringify({ name: 'Sam', lastLevel: 't2.2', cleared: ['t2.1', 7, null], extra: true }),
    );
    expect(loadProgress(store)).toEqual({
      name: 'Sam',
      lastLevel: 't2.2',
      cleared: ['t2.1'],
      locale: 'en',
    });
  });

  it('remembers the language, and defaults to English', () => {
    expect(loadProgress(store).locale).toBe('en');
    saveProgress(store, { ...DEFAULT_PROGRESS, locale: 'yue' });
    expect(loadProgress(store).locale).toBe('yue');

    // anything else falls back rather than silencing the app
    store.setItem('clock.v1.progress', JSON.stringify({ locale: 'fr' }));
    expect(loadProgress(store).locale).toBe('en');
  });

  it('trims the name and ignores an empty one', () => {
    expect(setName(DEFAULT_PROGRESS, '   Sam  ').name).toBe('Sam');
    expect(setName({ ...DEFAULT_PROGRESS, name: 'Sam' }, '   ').name).toBe('Sam');
  });

  it('caps the name so a pasted paragraph cannot break the layout', () => {
    expect(setName(DEFAULT_PROGRESS, 'x'.repeat(80)).name).toHaveLength(20);
  });

  // AC-23
  it('records a cleared level once, however many times it is cleared', () => {
    const once = markCleared(DEFAULT_PROGRESS, 't2.1');
    const twice = markCleared(once, 't2.1');
    expect(once.cleared).toEqual(['t2.1']);
    expect(twice.cleared).toEqual(['t2.1']);
  });

  it('remembers where the child got to', () => {
    expect(rememberLevel(DEFAULT_PROGRESS, 't3.2').lastLevel).toBe('t3.2');
  });

  it('shrugs when the store refuses to write', () => {
    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    expect(() => saveProgress(blocked, DEFAULT_PROGRESS)).not.toThrow();
  });

  it('does not mutate the progress passed in', () => {
    const before = { ...DEFAULT_PROGRESS, cleared: [] as string[] };
    markCleared(before, 't2.1');
    setName(before, 'Sam');
    expect(before.cleared).toEqual([]);
    expect(before.name).toBe('');
  });
});