import { describe, it, expect } from 'vitest';
import { scoreDoc, computeIdf } from '../../src/lib/agent-search/bm25';
import type { IndexedDoc } from '../../src/lib/agent-search/types';

function makeDoc(id: string, tf: Record<string, number>): IndexedDoc {
  const length = Object.values(tf).reduce((a, b) => a + b, 0);
  return {
    id,
    kind: 'faq',
    title: id,
    tf,
    length,
    text: '',
    citation: {
      canonical_url: `https://example.com/${id}`,
      markdown_url: `https://example.com/${id}.md`,
      title: id,
      kind: 'faq',
      last_modified: '2026-01-01',
    },
  };
}

describe('computeIdf', () => {
  it('rare terms get higher idf than common terms', () => {
    const docs = [
      makeDoc('d1', { msp: 1, the: 5 }),
      makeDoc('d2', { the: 4 }),
      makeDoc('d3', { the: 3 }),
    ];
    const idf = computeIdf(docs);
    expect(idf.msp).toBeGreaterThan(idf.the);
  });

  it('returns 0 idf for unseen terms via missing key', () => {
    const docs = [makeDoc('d1', { msp: 1 })];
    const idf = computeIdf(docs);
    expect(idf.unseen).toBeUndefined();
  });
});

describe('scoreDoc', () => {
  const docs = [
    makeDoc('msp-faq', { msp: 5, price: 3, support: 2 }),
    makeDoc('rte-faq', { rte: 4, education: 6 }),
    makeDoc('agri-faq', { msp: 1, agriculture: 4 }),
  ];
  const idf = computeIdf(docs);
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / docs.length;

  it('ranks doc with most query-term overlap highest', () => {
    const scores = docs.map((d) => ({
      id: d.id,
      score: scoreDoc(['msp'], d, idf, avgLen),
    }));
    scores.sort((a, b) => b.score - a.score);
    expect(scores[0].id).toBe('msp-faq');
  });

  it('returns 0 when no query tokens match the doc', () => {
    const score = scoreDoc(['nonsense'], docs[0], idf, avgLen);
    expect(score).toBe(0);
  });

  it('multi-token query sums term contributions', () => {
    const scoreSingle = scoreDoc(['msp'], docs[0], idf, avgLen);
    const scoreCombined = scoreDoc(['msp', 'price'], docs[0], idf, avgLen);
    expect(scoreCombined).toBeGreaterThan(scoreSingle);
  });

  it('multi-token query ranks docs by combined relevance', () => {
    // Query mentions both "msp" and "agriculture". msp-faq has high msp tf
    // but no agriculture; agri-faq has both. Combined query should rank
    // agri-faq above rte-faq (no overlap) and at least competitive with msp-faq.
    const tokens = ['msp', 'agriculture'];
    const ranked = docs
      .map((d) => ({ id: d.id, score: scoreDoc(tokens, d, idf, avgLen) }))
      .sort((a, b) => b.score - a.score);
    expect(ranked[0].id).not.toBe('rte-faq');
    expect(ranked.find((r) => r.id === 'rte-faq')!.score).toBe(0);
  });
});
