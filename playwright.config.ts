import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end config.
 *
 * `reuseExistingServer` locally so a run does not fight the dev server you
 * already have open; CI starts its own. The suite needs a seeded database with
 * live quotes — see test/e2e/README.md.
 */
export default defineConfig({
  testDir: './test/e2e',
  // The comparison panel debounces at 350ms and then waits on a network round
  // trip, so assertions need more headroom than the 5s default.
  expect: { timeout: 10_000 },
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
