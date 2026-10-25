import { execFileSync } from 'node:child_process';

import { SKIP_ENV, baseVerdict, measureBehind, skipRequested } from './branch-base-rule';

function main(): void {
  if (skipRequested(process.env[SKIP_ENV])) {
    console.log(`branch-base: skipped because ${SKIP_ENV}=1`);
    return;
  }

  const behind = measureBehind((args) =>
    execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
  );

  const verdict = behind === undefined ? baseVerdict(Number.NaN) : baseVerdict(behind);
  if (verdict.ok) {
    console.log(`branch-base: ${verdict.message}`);
    return;
  }
  console.error(`branch-base: ${verdict.message}`);
  process.exit(1);
}

main();
