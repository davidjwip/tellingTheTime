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
      exclude: ['src/types.ts'],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 90,
      },
    },
  },
});
