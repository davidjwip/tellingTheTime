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
 * Restoration, and why it has three layers:
 *
 *   1. a journal in `.mutants/` (gitignored) holds a backup of every file about to be mutated. It is
 *      written before the file changes and deleted after it is put back, so even SIGKILL or a power
 *      cut leaves enough on disk to put the tree right.
 *   2. the next run restores from that journal before doing anything else, and says so.
 *   3. the runner refuses to start on a dirty tree, and asserts the tree is clean when it finishes -
 *      a restore bug fails the gate instead of being discovered by the next commit.
 *
 * The child test run is asynchronous on purpose: with execFileSync the event loop blocks, so a SIGTERM
 * waits for the child and the "interrupted" message arrives seconds later than the interruption.
 *
 * Exit codes: 0 every mutation was killed, 1 one survived, 2 a mutation no longer applies (the code
 * moved, so the mutation must be updated), 3 the tree could not be proved clean, 4 the tree is dirty,
 * 5 the runner left something behind.
 */

import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const VITEST = 'vitest';
const PLAYWRIGHT = 'playwright';

const JOURNAL_DIR = '.mutants';
const JOURNAL = path.join(JOURNAL_DIR, 'journal.json');

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

/** Run a command and keep BOTH streams whichever way it ends. Asynchronous, so signals are prompt. */
const run = (command, args) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      // CI=1 makes Playwright start its own server, so it builds the MUTATED sources rather than
      // reusing a server already serving the last good build.
      env: { ...process.env, CI: '1' },
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', (error) => resolve({ ok: false, output: `${output}${error.message}` }));
    child.on('close', (code) => resolve({ ok: code === 0, output }));
  });

/** Fail closed: a tree we cannot measure is a tree we do not edit. */
const treeStatus = async () => {
  const result = await run('git', ['status', '--porcelain']);
  if (!result.ok) return { known: false, dirty: [] };
  return { known: true, dirty: result.output.split('\n').filter((line) => line.trim()) };
};

const readJournal = () => {
  if (!existsSync(JOURNAL)) return null;
  try {
    return JSON.parse(readFileSync(JOURNAL, 'utf8'));
  } catch {
    return null;
  }
};

/** Put back anything a previous run left mutated, before this run can be confused by it. */
const recoverFromJournal = () => {
  const journal = readJournal();
  if (!journal) return false;
  for (const entry of journal.entries ?? []) {
    if (existsSync(entry.backup)) writeFileSync(entry.file, readFileSync(entry.backup));
    console.log(`recovered ${entry.file} from an interrupted run (${journal.started})`);
  }
  clearJournal();
  return true;
};

const clearJournal = () => {
  rmSync(JOURNAL, { force: true });
  if (existsSync(JOURNAL_DIR)) {
    for (const file of readdirSync(JOURNAL_DIR)) {
      if (file.endsWith('.bak')) rmSync(path.join(JOURNAL_DIR, file), { force: true });
    }
  }
};

const writeJournal = (entries) => {
  mkdirSync(JOURNAL_DIR, { recursive: true });
  const temporary = `${JOURNAL}.tmp`;
  writeFileSync(temporary, JSON.stringify({ started: new Date().toISOString(), entries }, null, 1));
  renameSync(temporary, JOURNAL);
};

const main = async () => {
  recoverFromJournal();

  const before = await treeStatus();
  if (!before.known) {
    console.error('refusing to mutate: could not read `git status`, so cleanliness is unknown');
    process.exit(3);
  }
  if (before.dirty.length) {
    console.error('refusing to mutate: the tree has uncommitted changes');
    console.error(before.dirty.slice(0, 10).join('\n'));
    process.exit(4);
  }

  const snapshots = new Map(MUTATIONS.map((mutation) => [mutation.file, readFileSync(mutation.file, 'utf8')]));

  let restored = false;
  const restoreAll = () => {
    if (restored) return;
    restored = true;
    for (const [file, original] of snapshots) {
      try {
        if (readFileSync(file, 'utf8') !== original) writeFileSync(file, original);
      } catch (error) {
        console.error(`could not restore ${file}: ${error.message}`);
      }
    }
    clearJournal();
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
    const original = snapshots.get(mutation.file);
    const occurrences = original.split(mutation.find).length - 1;

    if (occurrences !== 1) {
      console.error(`STALE  ${mutation.name}`);
      console.error(
        occurrences === 0
          ? `       ${mutation.file} no longer contains the text this mutation edits.`
          : `       the anchor appears ${occurrences} times in ${mutation.file}; make it specific.`,
      );
      console.error('       Update the mutation: the behaviour it guards may have moved or gone.');
      stale += 1;
      continue;
    }

    const backup = path.join(JOURNAL_DIR, `${path.basename(mutation.file)}.bak`);
    mkdirSync(JOURNAL_DIR, { recursive: true });
    writeFileSync(backup, original);
    writeJournal([{ file: mutation.file, backup }]);

    try {
      writeFileSync(mutation.file, original.replace(mutation.find, mutation.replace));
      const result = await run('npx', [mutation.runner, ...mutation.args]);
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
      clearJournal();
    }
  }

  restoreAll();

  console.log('');
  console.log(`${MUTATIONS.length - survived - stale}/${MUTATIONS.length} mutations killed`);

  // The runner is part of the gate: if it left anything behind, that is a failure, not a footnote.
  const after = await treeStatus();
  if (!after.known || after.dirty.length) {
    console.error('the mutation runner left the tree dirty:');
    console.error(after.dirty.join('\n') || '(could not read git status)');
    process.exit(5);
  }

  if (stale > 0) process.exit(2);
  if (survived > 0) process.exit(1);
};

await main();
