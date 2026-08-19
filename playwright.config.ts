import { devices, type PlaywrightTestConfig } from '@playwright/test';

const shareApiPort = Number(process.env.SHARE_TEST_API_PORT || 3000);

const config: PlaywrightTestConfig = {
  testDir: 'tests/playwright',
  timeout: process.env.CI ? 60 * 5 * 1000 : 30 * 1000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  webServer: [
    {
      command: 'node tests/playwright/start-share-api.mjs',
      port: shareApiPort,
      timeout: 120 * 1000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev:mocked',
      port: 1235,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  use: {
    baseURL: 'http://localhost:1235/',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  snapshotPathTemplate: '{snapshotDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}',
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
};
export default config;
