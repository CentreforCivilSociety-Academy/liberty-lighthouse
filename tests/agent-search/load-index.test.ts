import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadIndex,
  _setIndexForTesting,
} from '../../src/lib/agent-search/load-index';
import type { AgentIndex } from '../../src/lib/agent-search/types';

const stubIndex: AgentIndex = {
  docs: [],
  idf: {},
  meta: {
    built_at: '2026-01-01T00:00:00.000Z',
    corpus_count: 0,
    avg_doc_length: 0,
  },
};

describe('loadIndex test seam', () => {
  beforeEach(() => {
    _setIndexForTesting(stubIndex);
  });

  it('returns the primed index', async () => {
    const idx = await loadIndex();
    expect(idx).toBe(stubIndex);
  });

  it('subsequent calls return the same instance (cache hit)', async () => {
    const a = await loadIndex();
    const b = await loadIndex();
    expect(a).toBe(b);
  });
});
