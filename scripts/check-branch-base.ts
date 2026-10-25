import { execFileSync } from 'node:child_process';

import { baseVerdict } from './branch-base-rule';

function countBehind(): number {
  const raw = execFileSync('git', ['rev-list', '--count', 'HEAD..origin/main'], { encoding: 'utf8' });
  return Number.parseInt(raw.trim(), 10);
}

function main(): void {
  const verdict = baseVerdict(countBehind());
  if (verdict.ok) {
    console.log(`branch-base: ${verdict.message}`);
    return;
  }
  console.error(`branch-base: ${verdict.message}`);
  process.exit(1);
}

main();
