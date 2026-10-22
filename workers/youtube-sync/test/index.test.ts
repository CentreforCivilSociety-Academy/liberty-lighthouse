import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import type { RunSummary, VideoRecord } from '../src/ledger';
import { API_KEY, BRANCH, MemoryKv, REPO, createWorld } from './helpers';

const VARS = {
  CHANNEL_ID: 'UCF5Yih_yIqBwO0LX_qcdQgA',
  GITHUB_REPO: REPO,
  TARGET_BRANCH: BRANCH,
  PUBLISH_MODE: 'review',
  JEV_MODEL: 'typesafe/jev-1.14',
  AUTO_CONFIDENCE: '0.9',
  MAX_VIDEOS_PER_RUN: '4',
  ALLOW_MAIN: 'false',
};
const ADMIN = 'admin-test-token-0123456789';
const BASE = 'https://liberty-lighthouse-youtube-sync-dev.example.workers.dev';

/**
 * The Worker's Env with the in-memory KV in place of the binding. This is the
 * one cast in the tests, and it is deliberate: MemoryKv implements the four
 * KV calls the Worker makes (get, put, delete, list), not all of KVNamespace.
 */
function testEnv(extra: Record<string, string> = {}): { env: Env; kv: MemoryKv } {
  const kv = new MemoryKv();
  return { env: { ...VARS, ...extra, LEDGER: kv } as unknown as Env, kv };
}

function send(env: Env, method: string, path: string, authorization?: string): Promise<Response> {
  const headers: Record<string, string> = authorization === undefined ? {} : { Authorization: authorization };
  return worker.fetch(new Request(`${BASE}${path}`, { method, headers }), env);
}

interface StatusBody {
  config: Record<string, unknown>;
  lastRun: RunSummary | null;
  counts: Record<string, number>;
  videos: Array<Partial<VideoRecord> & { staged?: Record<string, unknown> }>;
}

function record(videoId: string, published: string, extra: Partial<VideoRecord>): string {
  const base: VideoRecord = {
    videoId,
    title: `Video ${videoId}`,
    published,
    url: `https://www.youtube.com/shorts/${videoId}`,
    format: 'short',
    status: 'pending',
    attempts: 0,
    firstSeenAt: '2026-10-22T00:00:00.000Z',
    updatedAt: '2026-10-22T00:00:00.000Z',
  };
  return JSON.stringify({ ...base, ...extra });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the HTTP surface', () => {
  it('does not exist without ADMIN_TOKEN: every request is a 404', async () => {
    const { env } = testEnv();
    for (const [method, path] of [
      ['GET', '/status'],
      ['POST', '/run'],
      ['GET', '/'],
    ]) {
      expect((await send(env, method ?? 'GET', path ?? '/', `Bearer ${ADMIN}`)).status).toBe(404);
    }
  });

  it('gives a missing or wrong token the same 404 as an unknown path', async () => {
    const { env } = testEnv({ ADMIN_TOKEN: ADMIN });
    const wrong = [
      undefined,
      'Bearer nope',
      `Bearer ${ADMIN}x`,
      `Bearer ${ADMIN.slice(0, -1)}`,
      `Bearer ${ADMIN} extra`,
      `Basic ${ADMIN}`,
      ADMIN,
      'Bearer',
    ];
    for (const authorization of wrong) {
      const response = await send(env, 'GET', '/status', authorization);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Not found');
    }
  });

  it('serves /status to the right token: config, last run, counts and videos, newest first', async () => {
    const { env, kv } = testEnv({
      ADMIN_TOKEN: ADMIN,
      OPENROUTER_API_KEY: 'sk-or-must-not-appear',
      GITHUB_TOKEN: 'github-must-not-appear',
    });
    await kv.put(
      'video:abcdefghijk',
      record('abcdefghijk', '2026-10-01T00:00:00+00:00', {
        status: 'staged',
        staged: { path: 'src/content/videos/gst/a.mdx', mdx: '---\ntopic: gst\n---\n', draft: true },
      }),
    );
    await kv.put('video:bcdefghijkl', record('bcdefghijkl', '2026-10-05T00:00:00+00:00', { status: 'committed' }));

    const response = await send(env, 'GET', '/status', `Bearer ${ADMIN}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as StatusBody;
    expect(body.config).toMatchObject({ mode: 'commit', targetBranch: BRANCH, publishMode: 'review', autoConfidence: 0.9 });
    expect(body.counts).toEqual({ pending: 0, staged: 1, committed: 1, exists: 0, needs_review: 0, failed: 0 });
    expect(body.videos.map((video) => video.videoId)).toEqual(['bcdefghijkl', 'abcdefghijk']);
    expect(body.videos[1]?.staged).toEqual({ path: 'src/content/videos/gst/a.mdx', draft: true });
    expect(JSON.stringify(body)).not.toMatch(/must-not-appear|admin-test-token/);

    const full = (await (await send(env, 'GET', '/status?full=1', `Bearer ${ADMIN}`)).json()) as StatusBody;
    expect(full.videos[1]?.staged).toEqual({ path: 'src/content/videos/gst/a.mdx', mdx: '---\ntopic: gst\n---\n', draft: true });
  });

  it('answers anything else with a 404, even with the right token', async () => {
    const { env } = testEnv({ ADMIN_TOKEN: ADMIN });
    for (const [method, path] of [
      ['GET', '/run'],
      ['POST', '/status'],
      ['GET', '/'],
      ['DELETE', '/status'],
      ['GET', '/status/extra'],
    ]) {
      expect((await send(env, method ?? 'GET', path ?? '/', `Bearer ${ADMIN}`)).status).toBe(404);
    }
  });

  it('runs the sync on POST /run and returns the summary', async () => {
    const world = createWorld();
    vi.stubGlobal('fetch', world.fetch);
    const { env, kv } = testEnv({ ADMIN_TOKEN: ADMIN, OPENROUTER_API_KEY: 'sk-or-test-0000000000' });

    const response = await send(env, 'POST', '/run', `Bearer ${ADMIN}`);
    expect(response.status).toBe(200);
    const summary = (await response.json()) as RunSummary;
    expect(summary).toMatchObject({ trigger: 'manual', mode: 'stage', staged: 4, committed: 0, errors: [] });
    expect(summary.feed).toEqual({ ok: true, source: 'rss', attempts: 1, entries: 15 });
    expect(JSON.parse(kv.data.get('run:last') ?? 'null')).toEqual(summary);
    expect(world.calls.some((call) => call.method !== 'GET' && call.url.startsWith('https://api.github.com/'))).toBe(false);
  });

  it('detects through the Data API when YOUTUBE_API_KEY is set, and /status says so without showing the key', async () => {
    const world = createWorld();
    vi.stubGlobal('fetch', world.fetch);
    const { env } = testEnv({ ADMIN_TOKEN: ADMIN, OPENROUTER_API_KEY: 'sk-or-test-0000000000', YOUTUBE_API_KEY: API_KEY });

    const summary = (await (await send(env, 'POST', '/run', `Bearer ${ADMIN}`)).json()) as RunSummary;
    expect(summary.feed).toEqual({ ok: true, source: 'api', attempts: 2, entries: 13 });

    const text = await (await send(env, 'GET', '/status?full=1', `Bearer ${ADMIN}`)).text();
    expect(text).not.toContain(API_KEY);
    const status = JSON.parse(text) as StatusBody;
    expect(status.config).toMatchObject({ mode: 'stage', detection: 'api' });
    expect(status.lastRun?.feed).toMatchObject({ source: 'api' });
  });

  it('answers 409 on POST /run while another run holds the lock', async () => {
    const world = createWorld();
    vi.stubGlobal('fetch', world.fetch);
    const { env, kv } = testEnv({ ADMIN_TOKEN: ADMIN, OPENROUTER_API_KEY: 'sk-or-test-0000000000' });
    await kv.put('lock:run', '2026-10-22T05:59:00.000Z', { expirationTtl: 600 });

    const response = await send(env, 'POST', '/run', `Bearer ${ADMIN}`);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ skipped: 'locked' });
    expect(world.calls).toHaveLength(0);
  });

  it('records a configuration error as the run summary, so /status can say why nothing ran', async () => {
    const world = createWorld();
    vi.stubGlobal('fetch', world.fetch);
    const { env } = testEnv({ ADMIN_TOKEN: ADMIN, OPENROUTER_API_KEY: 'sk-or-test-0000000000', GITHUB_REPO: '' });

    const summary = (await (await send(env, 'POST', '/run', `Bearer ${ADMIN}`)).json()) as RunSummary;
    expect(summary.errors).toEqual(['config: GITHUB_REPO is not set']);
    expect(world.calls).toHaveLength(0);

    const status = (await (await send(env, 'GET', '/status', `Bearer ${ADMIN}`)).json()) as StatusBody;
    expect(status.config).toEqual({ error: 'GITHUB_REPO is not set' });
    expect(status.lastRun?.errors).toEqual(['config: GITHUB_REPO is not set']);
  });
});

describe('the cron trigger', () => {
  it('runs the sync', async () => {
    const world = createWorld();
    vi.stubGlobal('fetch', world.fetch);
    const { env, kv } = testEnv({ OPENROUTER_API_KEY: 'sk-or-test-0000000000' });
    await worker.scheduled({ cron: '0 */6 * * *', scheduledTime: Date.now(), noRetry() {} }, env);
    expect(JSON.parse(kv.data.get('run:last') ?? 'null')).toMatchObject({ trigger: 'cron', mode: 'stage', staged: 4 });
  });
});
