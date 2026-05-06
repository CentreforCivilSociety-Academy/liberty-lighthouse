/**
 * Public payload contracts for the agents API.
 *
 * Each endpoint's handler returns one of these. Wrappers serialize them
 * to JSON. Shapes match docs/agents-api.md §5 (tool surface).
 */
import type { Citation, SearchHit, ContentKind } from '../agent-search/types.js';

export interface CorpusSummary {
  topics: number;
  faqs: number;
  videos: number;
  glossary: number;
  wiki: number;
  external: number;
  last_updated: string;
}

export interface IndexPayload {
  llms_txt: string;
  agents_md: string;
  corpus_summary: CorpusSummary;
}

export interface SearchPayload {
  query: string;
  hits: SearchHit[];
}

export interface FetchPayload {
  markdown: string;
  citation: Citation;
}

export interface GlossaryTerm {
  term: string;
  short_definition: string;
  citation: Citation;
}

export interface GlossaryPayload {
  terms: GlossaryTerm[];
}

export interface TopicListing {
  slug: string;
  title: string;
  description: string;
  counts: {
    faqs: number;
    videos: number;
  };
  citation: Citation;
}

export interface TopicsPayload {
  topics: TopicListing[];
}

/** Inputs to handlers. */
export interface SearchInput {
  query: string;
  k?: number;
  kinds?: ContentKind[];
}

export interface FetchInput {
  url: string;
}

export interface ListGlossaryInput {
  filter?: string;
}
