import { describe, expect, it } from 'vitest';
import { type DecideOptions, decide } from '../src/decide';

// AUTO_CONFIDENCE as wrangler.jsonc sets it.
const options: DecideOptions = {
  topicSlugs: ['agriculture', 'education', 'gst', 'labor', 'property', 'pubc', 'urban'],
  autoConfidence: 0.9,
};

/** A Decisions API response with the given answers (either may be left out). */
function response(topic?: Record<string, unknown>, inScope?: Record<string, unknown>): unknown {
  const answers: Record<string, unknown> = {};
  if (topic) answers.topic = topic;
  if (inScope) answers.in_scope = inScope;
  return {
    id: 'gen-1',
    model: 'typesafe/jev-1.14-20261014',
    answers,
    usage: { input_tokens: 600, output_tokens: 0 },
  };
}

function choice(choice: string, confidence?: number | null, probabilities?: Record<string, number>) {
  const answer: Record<string, unknown> = { type: 'choice', choice };
  if (confidence !== undefined) answer.confidence = confidence;
  if (probabilities) answer.probabilities = probabilities;
  return answer;
}

const noul = (value: unknown) => ({ type: 'noul', noul: value });

describe('decide, with valid answers', () => {
  it('calls a clear, high-confidence answer confident, noting the runner-up', () => {
    const probabilities = { gst: 0.94, labor: 0.03, pubc: 0.02, other: 0.01 };
    expect(decide(response(choice('gst', 0.94, probabilities), noul(0.97)), options)).toEqual({
      outcome: 'confident',
      reason: null,
      writeFile: true,
      topic: 'gst',
      confidence: 0.94,
      probabilities,
      runnerUp: { topic: 'labor', probability: 0.03 },
      inScope: 0.97,
    });
  });

  it('keeps overlapping topics (low confidence) as a draft under the chosen topic', () => {
    const decision = decide(response(choice('labor', 0.52, { labor: 0.52, pubc: 0.41, gst: 0.07 }), noul(0.93)), options);
    expect(decision).toMatchObject({
      outcome: 'needs_review',
      reason: 'low_confidence',
      writeFile: true,
      topic: 'labor',
      runnerUp: { topic: 'pubc', probability: 0.41 },
    });
  });

  it('treats "other" as out of scope, and writes no file', () => {
    expect(decide(response(choice('other', 0.9), noul(0.9)), options)).toMatchObject({
      outcome: 'needs_review',
      reason: 'out_of_scope',
      writeFile: false,
      topic: 'other',
    });
  });

  it('treats in-scope below 0.2 as out of scope, however sure the topic', () => {
    expect(decide(response(choice('gst', 0.99), noul(0.19)), options)).toMatchObject({
      reason: 'out_of_scope',
      writeFile: false,
    });
    // How the off-topic uploads scored in calibration.
    expect(decide(response(choice('pubc', 0.6), noul(0.02)), options)).toMatchObject({ reason: 'out_of_scope' });
  });

  it('does not count in-scope of exactly 0.2 as out of scope, but will not call it confident', () => {
    expect(decide(response(choice('gst', 0.95), noul(0.2)), options)).toMatchObject({
      outcome: 'needs_review',
      reason: 'low_confidence',
      writeFile: true,
    });
  });

  it('keeps a real explainer that scored in-scope 0.47 in calibration, as a draft rather than dropping it', () => {
    expect(decide(response(choice('gst', 0.97), noul(0.47)), options)).toMatchObject({
      outcome: 'needs_review',
      reason: 'low_confidence',
      writeFile: true,
      topic: 'gst',
    });
  });

  it('keeps a sure topic as a draft when in-scope is between 0.2 and 0.8', () => {
    expect(decide(response(choice('gst', 0.95), noul(0.79)), options)).toMatchObject({ reason: 'low_confidence' });
  });

  it('keeps the 0.8–0.9 confidence band as drafts: in calibration it was right only 76% of the time', () => {
    expect(decide(response(choice('gst', 0.85), noul(0.95)), options)).toMatchObject({
      outcome: 'needs_review',
      reason: 'low_confidence',
      writeFile: true,
    });
  });

  it('treats a missing (or null) confidence as unknown: a draft, reason no_confidence', () => {
    for (const answer of [choice('gst'), choice('gst', null)]) {
      expect(decide(response(answer, noul(0.95)), options)).toMatchObject({
        outcome: 'needs_review',
        reason: 'no_confidence',
        writeFile: true,
        confidence: null,
        runnerUp: null,
      });
    }
  });

  it('includes both thresholds: confidence 0.9 with in-scope 0.8 is confident', () => {
    expect(decide(response(choice('gst', 0.9), noul(0.8)), options).outcome).toBe('confident');
  });

  it('applies whatever AUTO_CONFIDENCE is configured', () => {
    expect(decide(response(choice('gst', 0.92), noul(0.95)), { ...options, autoConfidence: 0.95 })).toMatchObject({
      reason: 'low_confidence',
    });
    expect(decide(response(choice('gst', 0.85), noul(0.95)), { ...options, autoConfidence: 0.8 }).outcome).toBe(
      'confident',
    );
  });

  it('treats null probabilities as absent, and breaks runner-up ties alphabetically', () => {
    expect(decide(response({ ...choice('gst', 0.9), probabilities: null }, noul(0.9)), options)).toMatchObject({
      probabilities: null,
      runnerUp: null,
    });
    const tie = decide(response(choice('gst', 0.5, { gst: 0.5, pubc: 0.25, labor: 0.25 }), noul(0.9)), options);
    expect(tie).toMatchObject({ runnerUp: { topic: 'labor', probability: 0.25 } });
  });
});

describe('decide, with malformed answers', () => {
  it.each<[string, unknown]>([
    ['a body that is not an object', null],
    ['no answers', { model: 'typesafe/jev-1.14-20261014' }],
    ['answers as an array', { answers: [] }],
    ['no topic answer', response(undefined, noul(0.9))],
    ['a topic answer of the wrong type', response({ type: 'noul', noul: 0.9 }, noul(0.9))],
    ['a choice that is not a string', response({ type: 'choice', choice: 3 }, noul(0.9))],
    ['a topic that does not exist', response(choice('economics', 0.9), noul(0.9))],
    ['a topic named by its filename instead of its slug', response(choice('public-choice', 0.9), noul(0.9))],
    ['probabilities naming an unknown topic', response(choice('gst', 0.9, { gst: 0.9, crypto: 0.1 }), noul(0.9))],
    ['a NaN probability', response(choice('gst', 0.9, { gst: Number.NaN }), noul(0.9))],
    ['a probability above 1', response(choice('gst', 0.9, { gst: 1.2 }), noul(0.9))],
    ['a negative probability', response(choice('gst', 0.9, { gst: 0.9, pubc: -0.1 }), noul(0.9))],
    ['a probability given as a string', response({ type: 'choice', choice: 'gst', probabilities: { gst: '0.9' } }, noul(0.9))],
    ['probabilities given as an array', response({ type: 'choice', choice: 'gst', probabilities: [0.9] }, noul(0.9))],
    ['a confidence above 1', response(choice('gst', 1.5), noul(0.9))],
    ['a NaN confidence', response(choice('gst', Number.NaN), noul(0.9))],
    ['no in_scope answer', response(choice('gst', 0.9))],
    ['an in_scope answer of the wrong type', response(choice('gst', 0.9), { type: 'choice', noul: 0.9 })],
    ['an in_scope value that is not a number', response(choice('gst', 0.9), noul('yes'))],
    ['an infinite in_scope value', response(choice('gst', 0.9), noul(Number.POSITIVE_INFINITY))],
  ])('rejects %s', (_name, body) => {
    const decision = decide(body, options);
    expect(decision.outcome).toBe('invalid');
    expect(decision.outcome === 'invalid' && decision.reason).toMatch(/\S/);
  });

  it('quotes what the model said, briefly, in the reason', () => {
    const decision = decide(response(choice('x'.repeat(500), 0.9), noul(0.9)), options);
    expect(decision.outcome === 'invalid' && decision.reason).toMatch(/^answers\.topic\.choice "x{60}" is not one of the listed topics$/);
  });
});
