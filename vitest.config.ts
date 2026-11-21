import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Determinism: tests never depend on wall-clock order or leaked state.
    sequence: { shuffle: false },
    restoreMocks: true,
    setupFiles: ['./vitest.setup.ts'],
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
      // Excluded files need a real browser (DOM mounting, WebGL, createImageBitmap); the
      // Playwright e2e tests cover them. See docs/adr/0003-image-display.md.
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.test-support.ts',
        'src/**/*.d.ts',
        'src/app/main.tsx',
        'src/render/pixi/**',
        'src/platform/browserImage.ts',
      ],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 75,
        'src/core/**': { lines: 90, branches: 90 },
      },
    },
  },
});
