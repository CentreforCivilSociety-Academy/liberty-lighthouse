/**
 * Public type contract for the agent-search package.
 *
 * `Citation` matches the §6 citation contract exactly — every search hit
 * and fetch response in the public API carries this shape.
 */

export type ContentKind =
  | 'topic'
  | 'faq'
  | 'video'
  | 'glossary'
  | 'wiki'
  | 'external'
  | 'syllabus';

export interface Citation {
  canonical_url: string;
  markdown_url: string;
  title: string;
  kind: ContentKind;
  last_modified: string;
}

export interface IndexedDoc {
  /** Stable doc id, e.g. "glossary/msp" or "faq/agriculture/why-msp" */
  id: string;
  kind: ContentKind;
  title: string;
  /** Token frequency map. Key = token; value = count in doc. */
  tf: Record<string, number>;
  /** Total token count for BM25 length normalisation. */
  length: number;
  /** Original text (used for snippet generation). */
  text: string;
  citation: Citation;
}

export interface AgentIndex {
  docs: IndexedDoc[];
  idf: Record<string, number>;
  meta: {
    built_at: string;
    corpus_count: number;
    avg_doc_length: number;
  };
}

export interface SearchHit {
  rank: number;
  score: number;
  kind: ContentKind;
  title: string;
  snippet: string;
  citation: Citation;
}

export interface SearchOptions {
  /** Max hits to return. Default 10, max 25. */
  k?: number;
  /** Restrict to specific kinds. Default: all. */
  kinds?: ContentKind[];
}
