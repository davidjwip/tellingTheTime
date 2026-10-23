/**
 * `npm run validate:levels` — the content gate.
 *
 * Fails the build on any of the eight integrity rules in specs/v1.md §4.5, naming the rule number
 * and the level id, because "invalid levels" is not an actionable error message.
 *
 * Runs through vite-node so the rules live in TypeScript next to the data they validate, rather
 * than being reimplemented in a script that can drift.
 */

import { LEVELS, validateLevels } from '../src/levels';

const violations = validateLevels(LEVELS);

if (violations.length === 0) {
  const clock = LEVELS.filter((l) => l.content.kind === 'clock').length;
  console.log(`levels ok: ${LEVELS.length} levels, ${clock} clock levels, all 8 rules pass`);
  process.exit(0);
}

console.error(`levels INVALID: ${violations.length} violation(s)\n`);
for (const v of violations) {
  console.error(`  rule ${v.rule}  ${v.levelId}  ${v.message}`);
}
const rules = [...new Set(violations.map((v) => v.rule))].sort((a, b) => a - b);
console.error(`\nfailing rules: ${rules.join(', ')}`);
process.exit(1);
