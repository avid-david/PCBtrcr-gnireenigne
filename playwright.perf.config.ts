import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/** `pnpm perf`: the frame-rate check, in a visible browser so it renders on the real GPU. */
export default defineConfig({
  ...base,
  testDir: 'e2e/perf',
  testIgnore: [],
  reporter: 'list',
  projects: [{ name: 'chromium-gpu', use: { ...devices['Desktop Chrome'], headless: false } }],
});
