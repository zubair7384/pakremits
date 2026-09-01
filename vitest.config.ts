import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Unit tests only. The Playwright e2e suite runs separately via `npm run e2e`.
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
