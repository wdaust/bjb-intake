import { defineConfig } from 'vitest/config'
import path from 'path'

// Vitest config is split out from vite.config.ts on purpose: vitest@3
// pulls in its own bundled vite, which conflicts with the rolldown-based
// vite in this repo when both live in the same config (Plugin types
// diverge). Keeping the test runner config separate lets `npm run build`
// use the real vite, and `npm test` use vitest's vite, with no overlap.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
