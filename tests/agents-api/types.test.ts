import { describe, it, expectTypeOf } from 'vitest';
import type { Citation } from '../../src/lib/agent-search';
import type {
  IndexPayload,
  SearchPayload,
  FetchPayload,
  GlossaryPayload,
  TopicsPayload,
} from '../../src/lib/agents-api/types';

describe('agents-api payload types', () => {
  it('IndexPayload shape', () => {
    expectTypeOf<IndexPayload>().toMatchTypeOf<{
      llms_txt: string;
      agents_md: string;
      corpus_summary: {
        topics: number;
        faqs: number;
        videos: number;
        glossary: number;
        wiki: number;
        external: number;
        last_updated: string;
      };
    }>();
  });

  it('SearchPayload shape', () => {
    expectTypeOf<SearchPayload>().toMatchTypeOf<{
      query: string;
      hits: Array<{
        rank: number;
        score: number;
        kind: string;
        title: string;
        snippet: string;
        citation: Citation;
      }>;
    }>();
  });

  it('FetchPayload shape', () => {
    expectTypeOf<FetchPayload>().toMatchTypeOf<{
      markdown: string;
      citation: Citation;
    }>();
  });

  it('GlossaryPayload shape', () => {
    expectTypeOf<GlossaryPayload>().toMatchTypeOf<{
      terms: Array<{
        term: string;
        short_definition: string;
        citation: Citation;
      }>;
    }>();
  });

  it('TopicsPayload shape', () => {
    expectTypeOf<TopicsPayload>().toMatchTypeOf<{
      topics: Array<{
        slug: string;
        title: string;
        description: string;
        counts: { faqs: number; videos: number };
        citation: Citation;
      }>;
    }>();
  });
});
