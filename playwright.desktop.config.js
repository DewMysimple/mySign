import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'desktop.spec.js',
  outputDir: 'test-results/desktop',
  workers: 1,
  timeout: 90000,
  expect: { timeout: 25000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'analysis/chinese/browser/desktop-browsers.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Edge',
      use: {
        browserName: 'chromium',
        channel: 'msedge',
        launchOptions: { args: ['--enable-unsafe-swiftshader'] },
      },
    },
    { name: 'Firefox', use: { browserName: 'firefox' } },
    { name: 'WebKit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
});
