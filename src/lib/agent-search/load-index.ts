/**
 * Runtime index loader.
 *
 * Lazy-loads _generated/index.json on first use and caches the result in
 * module scope so warm Vercel functions reuse it without re-parsing.
 *
 * Test seam: _setIndexForTesting() lets unit tests inject a synthetic
 * index without writing to disk. Tests deep-import this directly; it is
 * deliberately NOT re-exported from the public package barrel.
 */
import type { AgentIndex } from './types.js';

let cached: AgentIndex | null = null;

export async function loadIndex(): Promise<AgentIndex> {
  if (cached) return cached;
  // Dynamic import via a variable to bypass Vite/Rollup static path
  // analysis — the file is generated at deploy time and may not exist
  // during test or first build. Tests prime `cached` via
  // _setIndexForTesting() so this branch never fires.
  const path = './_generated/index.json';
  const mod = (await import(/* @vite-ignore */ path, {
    with: { type: 'json' },
  })) as { default: AgentIndex };
  cached = mod.default;
  return cached;
}

export function _setIndexForTesting(idx: AgentIndex): void {
  cached = idx;
}
