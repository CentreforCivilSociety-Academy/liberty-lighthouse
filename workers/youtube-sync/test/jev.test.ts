import { describe, expect, it } from 'vitest';
import { SubrequestBudget } from '../src/http';
import { DECISIONS_URL, type VideoInput, buildDecisionRequest, classify, readUsage } from '../src/jev';
import type { Topic } from '../src/repo';
import { hang, jevError, jevResponse } from './helpers';

const TOPICS: Topic[] = [
  { slug: 'gst', title: 'Goods and Services Tax', description: "Understanding India's Goods and Services Tax." },
  { slug: 'pubc', title: 'Public Choice', description: 'Understanding why governments do what they do.' },
  { slug: 'trade', title: 'Trade', description: '' },
];

const video: VideoInput = {
  title: '  Why Cutting GST on Food\n Helps the Rich ',
  description: 'Cutting GST on food sounds like help for the poor.\n\nRead more: https://ccs.in/gst #GST #India #नीति',
  format: 'short',
  published: '2026-08-30T08:38:23+00:00',
};

describe('buildDecisionRequest', () => {
  it('builds the verified body, model + state + questions, and nothing else (no output limit)', () => {
    const body = buildDecisionRequest(video, TOPICS, 'typesafe/jev-1.14');
    expect(Object.keys(body)).toEqual(['model', 'state', 'questions']);
    expect(JSON.stringify(body)).not.toMatch(/max_tokens|max_output/);
    expect(body).toEqual({
      model: 'typesafe/jev-1.14',
      state: {
        title: 'Why Cutting GST on Food Helps the Rich',
        description: 'Cutting GST on food sounds like help for the poor. Read more:',
        format: 'short',
        published: '2026-08-30',
      },
      questions: {
        topic: {
          type: 'choice',
          instructions:
            'Which topic page on Liberty Lighthouse, an explainer site about Indian economic and public policy, should this video be filed under?',
          criteria: {
            gst: "Goods and Services Tax: Understanding India's Goods and Services Tax.",
            pubc: 'Public Choice: Understanding why governments do what they do.',
            trade: 'Trade',
            other:
              'None of the listed topics fits: the video is not mainly about any of these policy areas (for example a channel announcement, an event recording, or an unrelated subject).',
          },
        },
        in_scope: {
          type: 'noul',
          instructions: 'Is this video a short explainer about an Indian economic, legal or public-policy question?',
          criteria: {
            true: 'It explains a policy, law, economic idea or government decision relevant to India.',
            false: 'It is promotional, an announcement, a recording of an event, or not about Indian policy.',
          },
        },
      },
    });
  });

  it('cuts a long description at a word boundary near 1,200 characters', () => {
    const { state } = buildDecisionRequest({ ...video, description: 'policy '.repeat(400) }, TOPICS, 'm');
    expect(state.description.length).toBeLessThanOrEqual(1_201);
    expect(state.description.length).toBeGreaterThan(1_100);
    expect(state.description.endsWith('policy…')).toBe(true);
  });

  it('is pure: the same input always gives the same body', () => {
    expect(buildDecisionRequest(video, TOPICS, 'm')).toEqual(buildDecisionRequest(video, TOPICS, 'm'));
  });
});

type Responder = (init: RequestInit | undefined) => Response | Promise<Response>;

function setup(responders: Responder[]) {
  const sleeps: number[] = [];
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const budget = new SubrequestBudget(50);
  const http = budget.wrap(async (url, init) => {
    calls.push({ url, init });
    const next = responders.shift();
    if (!next) throw new Error('more requests than the test expected');
    return next(init);
  });
  const go = () =>
    classify(
      {
        http,
        apiKey: 'sk-or-test-0000000000',
        sleep: async (ms) => {
          sleeps.push(ms);
        },
        random: () => 0.5,
        timeoutMs: 50,
      },
      buildDecisionRequest(video, TOPICS, 'typesafe/jev-1.14'),
    );
  return { sleeps, calls, go };
}

const ok: Responder = () => jevResponse({ choice: 'gst', confidence: 0.9, inScope: 0.95 });

describe('classify', () => {
  it('posts the body with the key and the attribution headers', async () => {
    const { calls, go } = setup([ok]);
    expect(await go()).toMatchObject({ ok: true, attempts: 1 });
    const call = calls[0];
    const headers = new Headers(call?.init?.headers);
    expect(call?.url).toBe(DECISIONS_URL);
    expect(call?.init?.method).toBe('POST');
    expect(headers.get('authorization')).toBe('Bearer sk-or-test-0000000000');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('http-referer')).toBe('https://www.libertylighthouse.in');
    expect(headers.get('x-title')).toBe('Liberty Lighthouse YouTube sync');
    expect(JSON.parse(String(call?.init?.body))).toEqual(buildDecisionRequest(video, TOPICS, 'typesafe/jev-1.14'));
  });

  it('waits out a 429 for as long as Retry-After says, then succeeds', async () => {
    const { sleeps, go } = setup([() => jevError(429, 'Rate limit exceeded', null, { 'retry-after': '2' }), ok]);
    expect(await go()).toMatchObject({ ok: true, attempts: 2 });
    expect(sleeps).toEqual([2_000]);
  });

  it('gives up after three 500s, pausing with backoff in between', async () => {
    const { calls, sleeps, go } = setup([1, 2, 3].map(() => () => jevError(500, 'Internal error')));
    const result = await go();
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([750, 2_250]);
    expect(result).toMatchObject({ ok: false, attempts: 3, error: { status: 500, fatal: false } });
  });

  it.each([502, 503, 524, 529])('retries a %i', async (status) => {
    const { calls, go } = setup([() => jevError(status, 'Upstream trouble'), ok]);
    expect(await go()).toMatchObject({ ok: true, attempts: 2 });
    expect(calls).toHaveLength(2);
  });

  it('does not retry a plain 402: the credits have run out, and that stops the run', async () => {
    const { calls, go } = setup([() => jevError(402, 'Insufficient credits')]);
    expect(await go()).toMatchObject({ ok: false, attempts: 1, error: { status: 402, fatal: true } });
    expect(calls).toHaveLength(1);
  });

  it("retries a 402 from OpenRouter's in-flight budget, flagged in error.metadata", async () => {
    const { calls, go } = setup([
      () => jevError(402, 'Too many requests in flight', { limit_source: 'openrouter_in_flight_budget' }),
      ok,
    ]);
    expect(await go()).toMatchObject({ ok: true, attempts: 2 });
    expect(calls).toHaveLength(2);
  });

  it('also recognises the in-flight flag at the top of the body', async () => {
    const inFlight = () =>
      new Response(
        JSON.stringify({ error: { code: 402, message: 'In flight' }, limit_source: 'openrouter_in_flight_budget' }),
        { status: 402 },
      );
    const { go } = setup([inFlight, ok]);
    expect(await go()).toMatchObject({ ok: true, attempts: 2 });
  });

  it.each([
    [400, false],
    [401, true],
    [403, false],
    [404, true],
    [413, false],
  ])('never retries a %i (fatal to the run: %s)', async (status, fatal) => {
    const { calls, go } = setup([() => jevError(status, 'No')]);
    expect(await go()).toMatchObject({ ok: false, attempts: 1, error: { status, fatal } });
    expect(calls).toHaveLength(1);
  });

  it('times out a request that hangs, and the retry succeeds', async () => {
    const { calls, go } = setup([(init) => hang(init), ok]);
    expect(await go()).toMatchObject({ ok: true, attempts: 2 });
    expect(calls[0]?.init?.signal?.aborted).toBe(true);
  });

  it('fails cleanly when every attempt times out', async () => {
    const { go } = setup([(init) => hang(init), (init) => hang(init), (init) => hang(init)]);
    expect(await go()).toMatchObject({
      ok: false,
      attempts: 3,
      error: { status: 0, message: 'no response within 0.05s', fatal: false },
    });
  });

  it('stops for this run, without waiting, when Retry-After is longer than is worth waiting', async () => {
    const { calls, sleeps, go } = setup([() => jevError(429, 'Slow down', null, { 'retry-after': '120' })]);
    expect(await go()).toMatchObject({ ok: false, attempts: 1 });
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it("keeps only OpenRouter's one-line message, never the body or its metadata", async () => {
    const { go } = setup([
      () => jevError(400, 'Bad request', { provider_raw: 'echo: Authorization: Bearer sk-or-test-0000000000' }),
    ]);
    const result = await go();
    expect(result.ok === false && result.error.message).toBe('OpenRouter 400: Bad request');
  });
});

describe('readUsage', () => {
  it('reads the snapshot that answered, the generation id, input tokens and cost', async () => {
    const body: unknown = await jevResponse({ choice: 'gst', confidence: 0.9, inScope: 0.95, cost: 0.0000252 }).json();
    expect(readUsage(body)).toEqual({
      model: 'typesafe/jev-1.14-20261014',
      generationId: 'gen-test',
      inputTokens: 600,
      cost: 0.0000252,
    });
  });

  it('is lenient: missing or odd bookkeeping is null, never an error', () => {
    expect(readUsage({ answers: {}, usage: { input_tokens: 'many', cost: -1 } })).toEqual({
      model: null,
      generationId: null,
      inputTokens: null,
      cost: null,
    });
    expect(readUsage(undefined)).toEqual({ model: null, generationId: null, inputTokens: null, cost: null });
  });
});
