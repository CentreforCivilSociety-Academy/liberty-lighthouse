import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      // `astro:content` is virtual — only available at Astro build/runtime.
      // Modules under src/lib that dynamically import it can be statically
      // analyzed by vite during test runs only if this import name resolves.
      'astro:content': fileURLToPath(
        new URL('./tests/stubs/astro-content.ts', import.meta.url),
      ),
    },
  },
});
