import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // the face renderer builds real DOM, and AC-04 is a claim about the DOM
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      // types.ts is type-only: excluding it keeps the number honest rather than padding it
      // types.ts is type-only, so it has no statements to cover. main.ts is bootstrap glue with no
      // branch worth asserting: mountPlay, which does have behaviour, is tested directly.
      exclude: ['src/types.ts', 'src/main.ts'],
      // perFile matters more than the numbers: a global aggregate lets one file sit at 78% as long
      // as the rest are high, which is exactly how a gate becomes decoration.
      thresholds: {
        perFile: true,
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 90,
      },
    },
  },
});
