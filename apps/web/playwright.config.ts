import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/__tests__',
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'bun run --filter "@d-m4th/server" dev',
      port: 2567,
      reuseExistingServer: !process.env.CI,
      cwd: '../../',
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'bun run --filter "@d-m4th/web" dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      cwd: '../../',
      stdout: 'pipe',
      stderr: 'pipe',
    }
  ]
});
