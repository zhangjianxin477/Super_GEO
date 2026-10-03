import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages serves this repository from /GEO-/. Local development keeps /.
  base: ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_ACTIONS) ? '/GEO-/' : '/',
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:8787', '/health': 'http://127.0.0.1:8787' },
    // Local browser-agent profiles, screenshots, and runtime logs can lock files on Windows.
    // They are operational artifacts, not application source, so Vite must never watch them.
    watch: {
      ignored: ['**/artifacts/**', '**/.runtime/**', '**/.runtime-logs/**', '**/browser-agent/**/profile/**'],
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})

