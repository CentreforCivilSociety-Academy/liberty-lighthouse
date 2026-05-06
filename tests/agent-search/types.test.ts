import { describe, it, expectTypeOf } from 'vitest';
import type {
  Citation,
  IndexedDoc,
  AgentIndex,
  SearchHit,
  SearchOptions,
  ContentKind,
} from '../../src/lib/agent-search';

describe('agent-search types', () => {
  it('Citation has the §6 contract shape', () => {
    expectTypeOf<Citation>().toMatchTypeOf<{
      canonical_url: string;
      markdown_url: string;
      title: string;
      kind: ContentKind;
      last_modified: string;
    }>();
  });

  it('SearchHit carries a citation', () => {
    expectTypeOf<SearchHit>().toMatchTypeOf<{
      rank: number;
      score: number;
      kind: ContentKind;
      title: string;
      snippet: string;
      citation: Citation;
    }>();
  });

  it('AgentIndex has docs, idf, meta', () => {
    expectTypeOf<AgentIndex>().toMatchTypeOf<{
      docs: IndexedDoc[];
      idf: Record<string, number>;
      meta: { built_at: string; corpus_count: number; avg_doc_length: number };
    }>();
  });

  it('SearchOptions accepts k and kinds', () => {
    expectTypeOf<SearchOptions>().toMatchTypeOf<{
      k?: number;
      kinds?: ContentKind[];
    }>();
  });
});
