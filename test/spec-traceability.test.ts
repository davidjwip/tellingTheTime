import { readFileSync, readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * The spec is the contract, so every criterion in it must name a test that proves it — and that test
 * must still exist.
 *
 * A criterion is credited by a `// AC-nn` comment on or just above an `it(`, or by the AC number in
 * the test's title. Two things fail the build: a criterion with no test and no recorded debt, and a
 * test claiming a criterion the spec no longer has.
 *
 * specs/untraced.json holds the debts. A debt that has since been paid fails too, so the list can
 * only shrink honestly.
 */

const SPEC = 'specs/v1.md';
const DEBTS = 'specs/untraced.json';

const declaredAcs = (): number[] => {
  const spec = readFileSync(SPEC, 'utf8');
  const bold = [...spec.matchAll(/\*\*AC-(\d+)\*\*/g)].map((m) => Number(m[1]));
  const headed = [...spec.matchAll(/^### AC-(\d+)/gm)].map((m) => Number(m[1]));
  return [...new Set([...bold, ...headed])].sort((a, b) => a - b);
};

interface Credit {
  ac: number;
  file: string;
  test: string;
}

const credits = (): Credit[] => {
  const found: Credit[] = [];
  for (const file of readdirSync('test').filter((name) => name.endsWith('.test.ts'))) {
    const lines = readFileSync(`test/${file}`, 'utf8').split('\n');
    lines.forEach((line, index) => {
      const opened = /^\s+it\((['"`])(.*?)\1/.exec(line);
      if (!opened) return;
      const title = opened[2] ?? '';
      const titled = [...title.matchAll(/AC-(\d+)/g)].map((m) => Number(m[1] ?? 0));
      const above: number[] = lines
        .slice(Math.max(0, index - 3), index)
        .flatMap((near) => [...near.matchAll(/AC-(\d+)/g)].map((m) => Number(m[1] ?? 0)));
      for (const ac of new Set([...titled, ...above])) {
        found.push({ ac, file: `test/${file}`, test: title });
      }
    });
  }
  return found;
};

describe('the spec and its tests agree', () => {
  // AC-84
  it('gives every criterion a test, or a recorded debt', () => {
    const declared = declaredAcs();
    const credited = new Set(credits().map((credit) => credit.ac));
    const debts = JSON.parse(readFileSync(DEBTS, 'utf8')) as { ac: number; why: string }[];
    const excused = new Set(debts.map((debt) => debt.ac));

    const orphans = declared.filter((ac) => !credited.has(ac) && !excused.has(ac));
    expect(orphans, `criteria with no test and no debt: ${orphans.map((ac) => `AC-${ac}`).join(', ')}`).toEqual([]);
  });

  // AC-84
  it('keeps no debt that has been paid, and no debt that is not a criterion', () => {
    const declared = new Set(declaredAcs());
    const credited = new Set(credits().map((credit) => credit.ac));
    const debts = JSON.parse(readFileSync(DEBTS, 'utf8')) as { ac: number; why: string }[];

    const paid = debts.filter((debt) => credited.has(debt.ac)).map((debt) => `AC-${debt.ac}`);
    expect(paid, `debts that now have a test, so the excuse is stale: ${paid.join(', ')}`).toEqual([]);

    const unknown = debts.filter((debt) => !declared.has(debt.ac)).map((debt) => `AC-${debt.ac}`);
    expect(unknown, `debts citing criteria the spec does not have: ${unknown.join(', ')}`).toEqual([]);

    const empty = debts.filter((debt) => debt.why.trim().length < 20).map((debt) => `AC-${debt.ac}`);
    expect(empty, `debts with no reason worth reading: ${empty.join(', ')}`).toEqual([]);
  });

  it('credits no test to a criterion that does not exist', () => {
    const declared = new Set(declaredAcs());
    const strays = credits()
      .filter((credit) => !declared.has(credit.ac))
      .map((credit) => `${credit.file}: AC-${credit.ac} (${credit.test})`);
    expect(strays, `tests claiming unknown criteria:\n${strays.join('\n')}`).toEqual([]);
  });
});
