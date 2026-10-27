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
 * Restoration is not "remember the file we are editing": that failed the first time this ran under a
 * signal. Every mutated file is snapshotted up front and put back by an idempotent `restoreAll()` on
 * every exit path - normal, thrown, or signal. At the end the runner asserts the tree is clean again,
 * so a restore bug fails the gate instead of being discovered by the next commit.
 *
 * Exit codes: 0 every mutation was killed, 1 one survived, 2 a mutation no longer applies (the code
 * moved, so the mutation must be updated), 3 the tree could not be proved clean, 4 the tree is dirty,
 * 5 the runner left something behind.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const VITEST = 'vitest';
const PLAYWRIGHT = 'playwright';

const MUTATIONS = [
  {
    name: 'the geared hour is judged instead of the hour the child chose',
    why: 'quarter-to placements become unwinnable (the blocker from PR #22)',
    file: 'src/play.ts',
    find: '        setChosen,\n        setHandsDrawn(),',
    replace:
      '        { hour: snapHour(setAngles.hour), minute: snapMinute(setAngles.minute, allowedMinutes()) },\n        setHandsDrawn(),',
    runner: VITEST,
    args: ['run', 'test/consistency.test.ts'],
  },
  {
    name: 'the build tolerance collapses to zero',
    why: 'B6 says ten of twelve within 12 degrees; a perfect face must still pass',
    file: 'src/build.ts',
    find: 'export const BUILD_TOLERANCE_DEGREES = 12;',
    replace: 'export const BUILD_TOLERANCE_DEGREES = 0;',
    runner: VITEST,
    args: ['run', 'test/build.test.ts'],
  },
  {
    name: 'a missed item comes back immediately',
    why: 'B2 requires at least three places of distance',
    file: 'src/engine.ts',
    find: 'export const REQUEUE_GAP = 3;',
    replace: 'export const REQUEUE_GAP = 0;',
    runner: VITEST,
    args: ['run', 'test/engine.test.ts'],
  },
  {
    name: 'the wrap distractor is the same hour as the answer',
    why: 'AC-82: the wrong answer is the hour before, and 13 only after twelve',
    file: 'src/choose.ts',
    find: '  const distractor = from === 12 ? 13 : from === 1 ? 12 : from - 1;',
    replace: '  const distractor = answer;',
    runner: VITEST,
    args: ['run', 'test/choose.test.ts'],
  },
  {
    name: 'a criterion loses its credit',
    why: 'the traceability ratchet must notice an untraced criterion',
    file: 'test/picker.test.ts',
    find: '  // AC-52\n',
    replace: '',
    runner: VITEST,
    args: ['run', 'test/spec-traceability.test.ts'],
  },
  {
    // The class happy-dom cannot see, and the worst defect this project shipped: the drag target sat
    // outside the <svg> and was never hit-testable, while 476 green tests certified it.
    name: 'the drag grab-strokes are appended outside the dial',
    why: 'an SVG element outside an <svg> has no box, so the hand is only a 4px target again',
    file: 'src/app.ts',
    find: '      dial.append(grab);',
    replace: '      frame.append(grab);',
    runner: PLAYWRIGHT,
    args: ['test', 'e2e/touch-drag.spec.ts', '--project=phone'],
  },
];

/** Runs a command and keeps BOTH streams whichever way it ends. */
const run = (command, args) => {
  try {
    const stdout = execFileSync(command, args, {
      stdio: 'pipe',
      encoding: 'utf8',
      // CI=1 makes Playwright start its own server, so it builds the MUTATED sources rather than
      // reusing a server already serving the last good build.
      env: { ...process.env, CI: '1' },
    });
    return { ok: true, output: stdout ?? '' };
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
};

/** Fail closed: a tree we cannot measure is a tree we do not edit. */
const treeIsClean = () => {
  const result = run('git', ['status', '--porcelain']);
  if (!result.ok) {
    console.error('refusing to mutate: could not read `git status`, so cleanliness is unknown');
    console.error(result.output.split('\n').slice(0, 5).join('\n'));
    return false;
  }
  if (result.output.trim()) {
    console.error('refusing to mutate: the tree has uncommitted changes');
    console.error(result.output.split('\n').slice(0, 10).join('\n'));
    return false;
  }
  return true;
};

if (!treeIsClean()) process.exit(4);

const SNAPSHOTS = new Map(MUTATIONS.map((mutation) => [mutation.file, readFileSync(mutation.file, 'utf8')]));

let restored = false;
const restoreAll = () => {
  if (restored) return;
  restored = true;
  for (const [file, original] of SNAPSHOTS) {
    try {
      if (readFileSync(file, 'utf8') !== original) writeFileSync(file, original);
    } catch (error) {
      console.error(`could not restore ${file}: ${error.message}`);
    }
  }
};

process.on('exit', restoreAll);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    restoreAll();
    console.error(`\ninterrupted by ${signal}; every mutated file was restored`);
    process.exit(130);
  });
}

let survived = 0;
let stale = 0;

for (const mutation of MUTATIONS) {
  const original = SNAPSHOTS.get(mutation.file);
  const occurrences = original.split(mutation.find).length - 1;

  if (occurrences === 0) {
    console.error(`STALE  ${mutation.name}`);
    console.error(`       ${mutation.file} no longer contains the text this mutation edits.`);
    console.error('       Update the mutation: the behaviour it guards may have moved or gone.');
    stale += 1;
    continue;
  }
  if (occurrences > 1) {
    console.error(`STALE  ${mutation.name}`);
    console.error(`       the anchor appears ${occurrences} times in ${mutation.file}; make it specific.`);
    stale += 1;
    continue;
  }

  try {
    writeFileSync(mutation.file, original.replace(mutation.find, mutation.replace));
    const result = run('npx', [mutation.runner, ...mutation.args]);
    if (result.ok) {
      survived += 1;
      console.error(`SURVIVED  ${mutation.name}`);
      console.error(`          ${mutation.why}`);
      console.error(`          ${mutation.runner} ${mutation.args.join(' ')} passed with the behaviour broken.`);
    } else {
      console.log(`killed    ${mutation.name}`);
    }
  } finally {
    writeFileSync(mutation.file, original);
    if (readFileSync(mutation.file, 'utf8') !== original) {
      console.error(`RESTORE FAILED for ${mutation.file}`);
      survived += 1;
    }
  }
}

console.log('');
console.log(`${MUTATIONS.length - survived - stale}/${MUTATIONS.length} mutations killed`);

// The runner is part of the gate: if it left anything behind, that is a failure, not a footnote.
const after = run('git', ['status', '--porcelain']);
if (!after.ok || after.output.trim()) {
  console.error('the mutation runner left the tree dirty:');
  console.error(after.output.trim() || '(could not read git status)');
  process.exit(5);
}

if (stale > 0) process.exit(2);
if (survived > 0) process.exit(1);
