import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Determinism: tests never depend on wall-clock order or leaked state.
    sequence: { shuffle: false },
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/core/**/*.test.ts', 'src/tools/**/*.test.ts', 'scripts/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/{ui,render,platform,app}/**/*.test.{ts,tsx}'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // main.tsx only mounts React into the DOM; it is covered by the Playwright smoke test.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/app/main.tsx', 'src/**/*.d.ts'],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 75,
        'src/core/**': { lines: 90, branches: 90 },
      },
    },
  },
});
