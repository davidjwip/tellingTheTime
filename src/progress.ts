
import type { Locale } from './audio';
/**
 * What the app remembers between visits.
 *
 * localStorage is not a database: it holds whatever a previous version of the app wrote, it can be
 * edited by hand, it can be disabled entirely (private browsing), and in a child's hands it can hold
 * anything. So every read validates, every failure falls back to a default, and nothing here throws.
 */

export interface Progress {
  name: string;
  lastLevel: string | null;
  cleared: string[];
  /** Which language the prompts are spoken in. */
  locale: Locale;
}

/** The bit of Storage this needs. Narrow on purpose, so a test can supply one. */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PROGRESS_KEY = 'clock.v1.progress';
export const NAME_MAX = 20;

export const DEFAULT_PROGRESS: Progress = { name: '', lastLevel: null, cleared: [], locale: 'en' };

export function loadProgress(store: Store): Progress {
  let raw: unknown;
  try {
    const text = store.getItem(PROGRESS_KEY);
    if (text === null) return DEFAULT_PROGRESS;
    raw = JSON.parse(text) as unknown;
  } catch {
    return DEFAULT_PROGRESS;
  }

  if (typeof raw !== 'object' || raw === null) return DEFAULT_PROGRESS;
  const shape = raw as Record<string, unknown>;

  return {
    name: typeof shape.name === 'string' ? shape.name.slice(0, NAME_MAX) : '',
    lastLevel: typeof shape.lastLevel === 'string' ? shape.lastLevel : null,
    cleared: Array.isArray(shape.cleared)
      ? shape.cleared.filter((id): id is string => typeof id === 'string')
      : [],
    locale: shape.locale === 'yue' || shape.locale === 'zh' ? shape.locale : 'en',
  };
}

export function saveProgress(store: Store, progress: Progress): void {
  try {
    store.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // a full or blocked store is not worth interrupting a round for
  }
}

/** Trim and cap. An empty name never overwrites a real one. */
export function setName(progress: Progress, raw: string): Progress {
  const name = raw.trim().slice(0, NAME_MAX);
  return name.length === 0 ? progress : { ...progress, name };
}

export function markCleared(progress: Progress, levelId: string): Progress {
  if (progress.cleared.includes(levelId)) return progress;
  return { ...progress, cleared: [...progress.cleared, levelId] };
}

export function rememberLevel(progress: Progress, levelId: string): Progress {
  return { ...progress, lastLevel: levelId };
}
