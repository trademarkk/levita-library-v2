import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appPort = Number(process.env.PLAYWRIGHT_APP_PORT || 5177);
const apiPort = Number(process.env.PLAYWRIGHT_API_PORT || 4274);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${appPort}`;
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sqlitePath = process.env.LEVTIA_SQLITE_PATH || path.resolve(rootDir, 'data', 'e2e-levtia-library.sqlite');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run test:e2e:serve',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      LEVTIA_STORAGE_DRIVER: 'sqlite',
      LEVTIA_DATA_MODE: 'app_state',
      LEVTIA_SQLITE_PATH: sqlitePath,
      LEVTIA_API_PORT: String(apiPort),
      LEVTIA_VITE_PORT: String(appPort),
      LEVTIA_AUTH_SECRET: 'levtia-e2e-auth-secret',
      MAX_REMINDER_LOCAL_CRON: 'false',
      GOOGLE_REQUEST_TIMEOUT_MS: '1000',
      MAX_REQUEST_TIMEOUT_MS: '1000',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
