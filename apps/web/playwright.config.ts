import { defineConfig, devices } from '@playwright/test';

const repoRoot = '../..';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @urb-tectrack/api dev',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: repoRoot,
      env: { ...process.env, E2E_TEST: 'true' },
    },
    {
      command: 'pnpm --filter @urb-tectrack/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: repoRoot,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
