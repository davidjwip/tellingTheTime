import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  audioUrl,
  chronoKeyFor,
  CLIPS,
  PHRASES,
  phraseText,
  promptKeyFor,
  Speaker,
} from '../src/audio';

import type { Sound } from '../src/audio';

describe('the phrases', () => {
  it('all have something to say in both languages', () => {
    for (const phrase of PHRASES) {
      expect(phrase.en.trim().length, `${phrase.key} en`).toBeGreaterThan(0);
      expect(phrase.yue.trim().length, `${phrase.key} yue`).toBeGreaterThan(0);
    }
  });

  it('has one clip per phrase per language, or the build fails', () => {
    // the failure this prevents is silence: a child staring at a clock with no question, and
    // nothing in the logs to say why
    const missing: string[] = [];
    for (const phrase of PHRASES) {
      for (const locale of ['en', 'yue'] as const) {
        const path = `public${audioUrl(phrase.key, locale)}`;
        if (!existsSync(path)) missing.push(path);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has no duplicate keys, so a recording cannot be orphaned by a rename', () => {
    const keys = PHRASES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reads its wording from the manifest that generated the clips', () => {
    expect(phraseText('prompt-read', 'en')).toBe('What time is it?');
    expect(phraseText('oclock-3', 'yue')).toBe('三點鐘');
    expect(phraseText('nope', 'en')).toBeUndefined();
  });
});

describe('which clip a clock face needs', () => {
  it("names the hour for o'clock, half past and quarters", () => {
    expect(chronoKeyFor({ hour: 3, minute: 0 })).toBe('oclock-3');
    expect(chronoKeyFor({ hour: 3, minute: 30 })).toBe('half-3');
    expect(chronoKeyFor({ hour: 3, minute: 15 })).toBe('qpast-3');
  });

  it('keeps the hour just passed for quarter to, because Cantonese says 三點九', () => {
    // English reads "quarter to four"; Cantonese says 三點九. The table was reviewed for this, so the
    // key follows the hour passed, not the hour coming
    expect(chronoKeyFor({ hour: 3, minute: 45 })).toBe('qto-3');
    expect(phraseText('qto-3', 'yue')).toBe('三點九');
    expect(phraseText('qto-3', 'en')).toBe('quarter to four');
  });

  it('treats midnight and noon as twelve', () => {
    expect(chronoKeyFor({ hour: 0, minute: 0 })).toBe('oclock-12');
    expect(chronoKeyFor({ hour: 12, minute: 0 })).toBe('oclock-12');
    expect(chronoKeyFor({ hour: 12, minute: 45 })).toBe('qto-12');
  });

  it('says nothing for a time it has no recording of', () => {
    expect(chronoKeyFor({ hour: 3, minute: 5 })).toBeUndefined();
    expect(chronoKeyFor({ hour: 3, minute: 7 })).toBeUndefined();
  });

  it('asks a question for reading and a nudge for everything else', () => {
    expect(promptKeyFor({ task: 'read' })).toBe('prompt-read');
    expect(promptKeyFor({ task: 'tap' })).toBe('prompt-tap');
  });
});

describe('the clips on disk', () => {
  it('matches the hash the generator recorded, so a swapped or stale clip fails the build', () => {
    // The existence check alone could not tell a correct clip from one generated for last week's
    // wording, or from a completely different file with the right name. The generator writes a
    // sha256 per clip into the manifest; this recomputes it.
    const wrong: string[] = [];
    for (const phrase of PHRASES) {
      for (const locale of ['en', 'yue'] as const) {
        const path = `public${audioUrl(phrase.key, locale)}`;
        const recorded = CLIPS[locale][phrase.key];
        if (!recorded) {
          wrong.push(`${locale}/${phrase.key}: no hash recorded`);
          continue;
        }
        const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
        if (actual !== recorded.sha256) wrong.push(`${locale}/${phrase.key}: bytes do not match the hash`);
        if (recorded.text !== phrase[locale]) wrong.push(`${locale}/${phrase.key}: text drifted`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('the speaker', () => {
  class FakeSound implements Sound {
    finished: (() => void) | null = null;
    paused = false;
    constructor(
      readonly url: string,
      private readonly log: string[],
    ) {}
    play(): Promise<void> {
      this.log.push(`play:${this.url}`);
      return Promise.resolve();
    }
    onEnded(callback: () => void): void {
      this.finished = callback;
    }
    pause(): void {
      this.paused = true;
      this.log.push(`pause:${this.url}`);
    }
    finish(): void {
      this.finished?.();
    }
  }

  const rig = () => {
    const log: string[] = [];
    const made: FakeSound[] = [];
    const make = (url: string): Sound => {
      const sound = new FakeSound(url, log);
      made.push(sound);
      return sound;
    };
    return { log, made, make, last: () => made[made.length - 1] };
  };

  it('plays the clip for the chosen language', () => {
    const r = rig();
    void new Speaker(r.make, 'yue').say('oclock-3');
    expect(r.log).toEqual(['play:/audio/yue/oclock-3.mp3']);
  });

  it('defaults to English', () => {
    const r = rig();
    void new Speaker(r.make).say('prompt-read');
    expect(r.log).toEqual(['play:/audio/en/prompt-read.mp3']);
  });

  it('resolves only when the clip has finished, so sounds can be sequenced', async () => {
    const r = rig();
    const speaker = new Speaker(r.make);
    let done = false;

    const said = speaker.say('praise-1').then(() => {
      done = true;
    });

    await Promise.resolve();
    expect(done).toBe(false); // still playing

    r.last()?.finish();
    await said;
    expect(done).toBe(true);
  });

  it('stays quiet when muted, and silences what is playing', () => {
    const r = rig();
    const speaker = new Speaker(r.make);
    void speaker.say('prompt-read');
    speaker.setMuted(true);
    expect(r.last()?.paused).toBe(true);

    void speaker.say('praise-1');
    expect(r.log.filter((line) => line.startsWith('play:'))).toHaveLength(1);
    expect(speaker.isMuted()).toBe(true);
  });

  it('interrupts the previous clip rather than queueing it', () => {
    const r = rig();
    const speaker = new Speaker(r.make);
    void speaker.say('prompt-read');
    void speaker.say('praise-1');
    expect(r.made[0]?.paused).toBe(true);
    expect(r.log.filter((line) => line.startsWith('play:'))).toHaveLength(2);
  });

  it('can change language without being rebuilt', () => {
    const r = rig();
    const speaker = new Speaker(r.make);
    speaker.setLocale('yue');
    void speaker.say('oclock-3');
    expect(r.log).toEqual(['play:/audio/yue/oclock-3.mp3']);
  });

  it('ignores a key it has no phrase for, and a blocked play()', () => {
    const played: string[] = [];
    const speaker = new Speaker((url) => ({
      play: () => {
        played.push(url);
        return Promise.reject(new Error('autoplay blocked'));
      },
      pause: () => undefined,
      onEnded: () => undefined,
    }));

    expect(() => speaker.say('does-not-exist')).not.toThrow();
    expect(played).toEqual([]);

    // a browser refusing to autoplay is expected, not something to surface mid-round
    expect(() => speaker.say('prompt-read')).not.toThrow();
    expect(played).toHaveLength(1);
  });
});
