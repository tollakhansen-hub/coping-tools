const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  testMatch: ['compat.spec.cjs', 'print-pagination.spec.cjs'],
  timeout: 30000,
  globalTimeout: 12 * 60 * 1000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: '../../playwright-report', open: 'never' }]],
  outputDir: '../../test-results',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', navigationTimeout: 20000 },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } }
  ]
});
