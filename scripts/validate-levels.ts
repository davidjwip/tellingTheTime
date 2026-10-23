/**
 * `npm run validate:levels` — the content gate.
 *
 * Fails the build on any of the eight integrity rules in specs/v1.md §4.5, naming the rule number
 * and the level id, because "invalid levels" is not an actionable error message.
 *
 * Runs through vite-node so the rules live in TypeScript next to the data they validate, rather
 * than being reimplemented in a script that can drift.
 */

import { checkLevelsFile, LEVELS } from '../src/levels';
import rawLevels from '../src/levels.json';

// shape first (attributed to the rule that owns each field), then the eight rules
const violations = checkLevelsFile(rawLevels as unknown);

if (violations.length === 0) {
  const clock = LEVELS.filter((l) => l.content.kind === 'clock').length;
  console.log(`levels ok: ${LEVELS.length} levels, ${clock} clock levels, all 8 rules pass`);
  console.log('note: rule 7 (audio keys) is skipped until an audio manifest exists');
  process.exit(0);
}

console.error(`levels INVALID: ${violations.length} violation(s)\n`);
for (const v of violations) {
  console.error(`  rule ${v.rule}  ${v.levelId}  ${v.message}`);
}
const rules = [...new Set(violations.map((v) => v.rule))].sort((a, b) => a - b);
console.error(`\nfailing rules: ${rules.join(', ')}`);
process.exit(1);
