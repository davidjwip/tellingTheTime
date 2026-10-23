import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { renderCelebration, renderPlay, renderSummary } from '../src/app';
import { createSession, recordVerdict, seededRng } from '../src/engine';
import { LEVELS } from '../src/levels';
import { ARTEFACT_DIR, writeScreen, writeSvg } from './artefacts';

import type { Session } from '../src/engine';
import type { Level } from '../src/types';

const level = (id: string): Level => {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`no level ${id}`);
  return found;
};

const session = (id: string): Session => createSession(level(id), seededRng(3));
const answerRight = (s: Session, n: number): Session => {
  let next = s;
  for (let i = 0; i < n; i += 1) next = recordVerdict(next, true);
  return next;
};

/**
 * One dial per rung of the ladder, drawn by the same code the app draws, so the picture in the PR
 * is the picture on the tablet. If one of these changes, the test fails and says which.
 */
const DIALS: Array<[string, string]> = [
  ['face-t1.3-count-in-fives', 't1.3'],
  ['face-t2.2-oclock', 't2.2'],
  ['face-t3.2-half-past', 't3.2'],
  ['face-t4.3-quarter-to', 't4.3'],
];

describe('viewable artefacts, written by the tests', () => {
  it.each(DIALS)('writes a standalone SVG for %s', (name, id) => {
    const screen = renderPlay(level(id), session(id));
    const svg = screen.querySelector('svg[data-face]');
    expect(svg, `${id} should draw a face`).not.toBeNull();

    const path = writeSvg(name, svg!);
    expect(existsSync(path)).toBe(true);

    const written = readFileSync(path, 'utf8');
    expect(written.startsWith('<?xml')).toBe(true);
    expect(written).toContain('<svg');
    expect(written.length).toBeGreaterThan(400);
  });

  it('draws twelve numerals and one hand on the o\'clock dial', () => {
    const written = readFileSync(`${ARTEFACT_DIR}/face-t2.2-oclock.svg`, 'utf8');
    expect(written.match(/data-numeral=/g)).toHaveLength(12);
    expect(written).toContain('data-hand="hour"');
    expect(written).not.toContain('data-hand="minute"');
  });

  it('draws both hands once the level has two', () => {
    const written = readFileSync(`${ARTEFACT_DIR}/face-t4.3-quarter-to.svg`, 'utf8');
    expect(written).toContain('data-hand="hour"');
    expect(written).toContain('data-hand="minute"');
  });

  it('writes a self-contained play screen with the stylesheet inlined', () => {
    const path = writeScreen('play-t2.2', renderPlay(level('t2.2'), session('t2.2')), "O'clock: all twelve");
    const html = readFileSync(path, 'utf8');

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('.clock-frame');
    expect(html).toContain('pad-yes');
    expect(html).toContain('goal-track');
    expect(html).toContain('Created for George and Teddy Ip.');
    // no external asset may be required to look at it
    expect(html).not.toMatch(/<script/);
  });

  it('writes a play screen part-way through a round, with the track filled', () => {
    const path = writeScreen(
      'play-t4.3-quarter-to-progress',
      renderPlay(level('t4.3'), answerRight(session('t4.3'), 4)),
      'Quarter to, four read',
    );
    const html = readFileSync(path, 'utf8');
    expect(html.match(/class="step filled"/g)).toHaveLength(4);
  });

  it('writes the summary and the celebration as pages too', () => {
    const summary = writeScreen('summary-t2.2', renderSummary(session('t2.2'), true), 'Cleared');
    expect(readFileSync(summary, 'utf8')).toContain('Level cleared!');

    const party = writeScreen('celebration-t2.2', renderCelebration(session('t2.2')), 'Party');
    const partyHtml = readFileSync(party, 'utf8');
    expect(partyHtml).toContain('Amazing Job');
    expect(partyHtml).toContain('celebration-overlay');
  });

  it('fails loudly when a committed artefact has changed, rather than redrawing it', () => {
    // re-blessing switches the guard off process-wide, so this test must force the guarded path or
    // it fails exactly when someone runs UPDATE_ARTEFACTS=1 - the moment it matters least
    const bless = process.env.UPDATE_ARTEFACTS;
    delete process.env.UPDATE_ARTEFACTS;
    try {
      const path = `${ARTEFACT_DIR}/face-t2.2-oclock.svg`;
      const before = readFileSync(path, 'utf8');
    // simulate a committed artefact that no longer matches what the code draws
    writeFileSync(path, 'stale');

    expect(() => writeSvg('face-t2.2-oclock', renderPlay(level('t2.2'), session('t2.2')).querySelector('svg')!))
      .toThrow(/changed/);

      writeFileSync(path, before);
      expect(readFileSync(path, 'utf8')).toBe(before);
    } finally {
      if (bless !== undefined) process.env.UPDATE_ARTEFACTS = bless;
    }
  });
});
