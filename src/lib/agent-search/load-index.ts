/**
 * Runtime index loader.
 *
 * Lazy-loads _generated/index.json on first use and caches the result in
 * module scope so warm Vercel functions reuse it without re-parsing.
 *
 * Promise-cache pattern: concurrent first calls share a single in-flight
 * Promise, so any post-processing inside loadIndex runs at most once even
 * under parallel cold-start traffic.
 *
 * Test seam: _setIndexForTesting() lets unit tests inject a synthetic
 * index without writing to disk. Tests deep-import this directly; it is
 * deliberately NOT re-exported from the public package barrel.
 */
import type { AgentIndex } from './types.js';

let inflight: Promise<AgentIndex> | null = null;

export function loadIndex(): Promise<AgentIndex> {
  if (!inflight) {
    inflight = (async () => {
      // Dynamic import so the JSON is bundled by Vite/Rollup but not read at
      // module-load time. Path is hoisted into a variable + @vite-ignore so
      // Vite's static-import-analysis doesn't pre-resolve and error on the
      // gitignored target. Production runtime (Node 22+ on Vercel) executes
      // this once on cold start.
      const path = './_generated/index.json';
      const mod = (await import(/* @vite-ignore */ path, {
        with: { type: 'json' },
      })) as { default: AgentIndex };
      return mod.default;
    })();
  }
  return inflight;
}

export function _setIndexForTesting(idx: AgentIndex): void {
  inflight = Promise.resolve(idx);
}
