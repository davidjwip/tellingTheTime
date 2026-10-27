#!/usr/bin/env node
/**
 * Break the code on purpose, and require the suite to notice.
 *
 * Every defect this repo has shipped had the same shape: a green suite that could not fail. So the
 * gate is a set of known mutations - each one a real bug from this project's history, or a contraction
 * of a rule the spec states - applied in turn to a clean tree. A surviving mutation means the tests no
 * longer defend that behaviour, and the job fails.
 *
 *     npm run mutants
 *
 * Exit codes: 0 every mutation was killed, 1 one survived, 2 a mutation no longer applies (the code
 * moved, so the mutation must be updated), 4 the tree is dirty.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const MUTATIONS = [
  {
    name: 'the geared hour is judged instead of the hour the child chose',
    why: 'quarter-to placements become unwinnable (the blocker from PR #22)',
    file: 'src/play.ts',
    find: '        setChosen,\n        setHandsDrawn(),',
    replace:
      '        { hour: snapHour(setAngles.hour), minute: snapMinute(setAngles.minute, allowedMinutes()) },\n        setHandsDrawn(),',
    test: 'test/consistency.test.ts',
  },
  {
    name: 'the build tolerance collapses to zero',
    why: 'B6 says ten of twelve within 12 degrees; a perfect face must still pass',
    file: 'src/build.ts',
    find: 'export const BUILD_TOLERANCE_DEGREES = 12;',
    replace: 'export const BUILD_TOLERANCE_DEGREES = 0;',
    test: 'test/build.test.ts',
  },
  {
    name: 'a missed item comes back immediately',
    why: 'B2 requires at least three places of distance',
    file: 'src/engine.ts',
    find: 'export const REQUEUE_GAP = 3;',
    replace: 'export const REQUEUE_GAP = 0;',
    test: 'test/engine.test.ts',
  },
  {
    name: 'the wrap distractor is the same hour as the answer',
    why: 'AC-82: the wrong answer is the hour before, and 13 only after twelve',
    file: 'src/choose.ts',
    find: '  const distractor = from === 12 ? 13 : from === 1 ? 12 : from - 1;',
    replace: '  const distractor = answer;',
    test: 'test/choose.test.ts',
  },
  {
    name: 'a criterion loses its credit',
    why: 'the traceability ratchet must notice an untraced criterion',
    file: 'test/picker.test.ts',
    find: '  // AC-52\n',
    replace: '',
    test: 'test/spec-traceability.test.ts',
  },
];

const run = (command, args) => {
  try {
    execFileSync(command, args, { stdio: 'pipe', encoding: 'utf8' });
    return { ok: true, output: '' };
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
};

const dirty = run('git', ['status', '--porcelain']);
if (dirty.ok && dirty.output.trim()) {
  console.error('refusing to mutate: the tree has uncommitted changes');
  console.error(dirty.output.split('\n').slice(0, 10).join('\n'));
  process.exit(4);
}

let survived = 0;
let stale = 0;

for (const mutation of MUTATIONS) {
  const original = readFileSync(mutation.file, 'utf8');
  if (!original.includes(mutation.find)) {
    console.error(`STALE  ${mutation.name}`);
    console.error(`       ${mutation.file} no longer contains the text this mutation edits.`);
    console.error('       Update the mutation: the behaviour it guards may have moved or gone.');
    stale += 1;
    continue;
  }

  writeFileSync(mutation.file, original.replace(mutation.find, mutation.replace));
  const result = run('npx', ['vitest', 'run', mutation.test, '--reporter=dot']);
  writeFileSync(mutation.file, original);

  if (result.ok) {
    survived += 1;
    console.error(`SURVIVED  ${mutation.name}`);
    console.error(`          ${mutation.why}`);
    console.error(`          ${mutation.test} passed with the behaviour broken.`);
  } else {
    console.log(`killed    ${mutation.name}`);
  }
}

console.log('');
console.log(`${MUTATIONS.length - survived - stale}/${MUTATIONS.length} mutations killed`);
if (stale > 0) process.exit(2);
if (survived > 0) process.exit(1);
