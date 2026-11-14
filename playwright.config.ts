import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 15_000,
  workers: 2,
  use: {
    baseURL: 'http://localhost:3099',
    viewport: { width: 1280, height: 900 },
    launchOptions: { executablePath: process.env.OPENNEWS_TEST_BROWSER || undefined },
  },
  webServer: {
    command: 'npm run build && npm start',
    url: 'http://localhost:3099/api/health',
    env: { PORT: '3099', NODE_ENV: 'production' },
  },
});
