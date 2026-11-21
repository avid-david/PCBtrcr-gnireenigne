import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCI = process.env.CI !== undefined;

export default defineConfig({
  testDir: 'e2e',
  // The frame-rate check needs a real GPU and minutes; it runs with `pnpm perf` instead.
  testIgnore: ['perf/**'],
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Smoke-test the production bundle, not the dev server.
  webServer: {
    command: `pnpm build && pnpm exec vite preview --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
