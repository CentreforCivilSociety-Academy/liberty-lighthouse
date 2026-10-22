import { defineConfig } from 'vitest/config';

// Plain Node tests: every upstream (YouTube, GitHub, OpenRouter) and the KV
// namespace is a fake from test/helpers.ts, so nothing touches the network.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
});
