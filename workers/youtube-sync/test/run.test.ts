import { describe, expect, it } from 'vitest';
import { cleanDescription } from '../src/text';
import {
  API_KEY,
  API_SECRETS,
  BRANCH,
  COMMIT_SECRETS,
  type FeedVideo,
  STAGE_SECRETS,
  buildFeed,
  createHarness,
  feedFixture,
  googleError,
  jevError,
  jevResponse,
  readFrontmatter,
  testConfig,
  videoMdx,
} from './helpers';
import { parseFeed } from '../src/feed';

const BOT = { name: 'liberty-lighthouse-bot', email: 'bot@liberty-lighthouse.local' };

const GST_VIDEO: FeedVideo = {
  id: 'NEWVIDEO001',
  title: 'Why GST Rates Keep Changing',
  description: 'Why the GST council keeps revising rates. #GST https://ccs.in/gst',
  published: '2026-10-20T04:00:00+00:00',
};
const GST_PATH = 'src/content/videos/gst/why-gst-rates-keep-changing.mdx';

const hosts = (calls: Array<{ url: string }>) => calls.map((call) => new URL(call.url).host);

describe('a first run against the real feed', () => {
  it('settles what the repo already has and commits the four oldest new videos, as drafts', async () => {
    const h = createHarness();
    const summary = await h.run();

    expect(summary).toMatchObject({
      trigger: 'cron',
      mode: 'commit',
      feed: { ok: true, attempts: 1, entries: 15 },
      newVideos: 15,
      classified: 4,
      committed: 4,
      staged: 0,
      needsReview: 0,
      failed: 0,
      errors: [],
    });
    expect(summary.costUsd).toBeCloseTo(4 * 0.0000252, 9);

    const statuses = h.kv.statuses();
    expect([statuses.lANiSBGrobs, statuses['v209Etn-c24'], statuses.r6VCoPrI4h0]).toEqual(['exists', 'exists', 'exists']);
    expect(Object.values(statuses).filter((status) => status === 'committed')).toHaveLength(4);
    expect(Object.values(statuses).filter((status) => status === 'pending')).toHaveLength(8);

    // Oldest first, each under the topic Jev chose, each named like the CMS would.
    expect(h.world.github.puts.map((put) => put.path)).toEqual([
      'src/content/videos/labor/competitive-wages-may-not-be-enough-to-attract-investment.mdx',
      'src/content/videos/education/why-more-school-funding-hasnt-fixed-indian-education.mdx',
      'src/content/videos/pubc/why-doing-less-made-india-richer.mdx',
      'src/content/videos/pubc/why-spending-20-000-crore-might-not-help-the-economy.mdx',
    ]);
    for (const put of h.world.github.puts) {
      expect(put).toMatchObject({ hasSha: false, branch: BRANCH, committer: BOT, authorization: 'Bearer github-test-token-0000' });
      expect(readFrontmatter(put.content).draft).toBe(true);
      expect(put.message.split('\n').at(-1)).toBe('[youtube-sync]');
    }

    const spending = h.world.github.puts[3];
    const entry = parseFeed(feedFixture).find((video) => video.videoId === 'kJhib23XYnU');
    expect(readFrontmatter(spending?.content ?? '')).toEqual({
      topic: 'pubc',
      title: 'Why Spending ₹20,000 Crore Might Not Help the Economy',
      youtubeId: 'kJhib23XYnU',
      format: 'short',
      orientation: 'vertical',
      description: cleanDescription(entry?.description ?? ''),
      order: 1,
      draft: true,
    });
    expect(spending?.message).toBe(
      [
        'Create Video “pubc/why-spending-20-000-crore-might-not-help-the-economy”',
        '',
        'YouTube: https://www.youtube.com/shorts/kJhib23XYnU',
        'Model: typesafe/jev-1.14-20261014',
        'Topic: pubc, confidence 0.91',
        'Status: draft',
        '[youtube-sync]',
      ].join('\n'),
    );

    expect(h.kv.record('kJhib23XYnU')).toMatchObject({
      status: 'committed',
      attempts: 0,
      classification: {
        model: 'typesafe/jev-1.14-20261014',
        topic: 'pubc',
        confidence: 0.91,
        inScope: 0.96,
        outcome: 'confident',
        basis: 'title+description',
        inputTokens: 600,
        generationId: 'gen-test',
      },
      commit: {
        branch: BRANCH,
        path: 'src/content/videos/pubc/why-spending-20-000-crore-might-not-help-the-economy.mdx',
        draft: true,
      },
    });
    expect(JSON.parse(h.kv.data.get('run:last') ?? 'null')).toEqual(summary);
    expect(h.kv.data.has('lock:run')).toBe(false);
  });

  it('works through the backlog over the next runs, then goes quiet', async () => {
    const h = createHarness();
    await h.run();
    expect((await h.run()).committed).toBe(4);
    expect((await h.run()).committed).toBe(4);
    expect(h.world.github.puts).toHaveLength(12);
    expect(h.world.jev.requests).toHaveLength(12);

    const before = h.world.calls.length;
    const quiet = await h.run();
    expect(quiet).toMatchObject({ newVideos: 0, classified: 0, committed: 0, errors: [] });
    // Nothing new: the feed is read and nothing else, not even GitHub.
    expect(hosts(h.world.calls.slice(before))).toEqual(['www.youtube.com']);
  });

  it('logs one structured line per step, and never a secret', async () => {
    const h = createHarness();
    await h.run();
    const events = h.events.map((event) => event.event);
    expect(events[0]).toBe('run.start');
    expect(events.at(-1)).toBe('run.done');
    expect(events).toEqual(expect.arrayContaining(['feed.ok', 'ledger.candidates', 'repo.snapshot', 'video.exists', 'video.classified', 'video.committed']));
    expect(JSON.stringify(h.events)).not.toMatch(/sk-or-test|github-test-token/);
  });
});

describe('dedupe and idempotence', () => {
  it('never asks Jev about a video the repo already holds', async () => {
    const h = createHarness();
    await h.run();
    expect(h.world.jev.titles()).not.toContain('Why So Many Indian Farmers Want to Quit');
    expect(h.kv.record('lANiSBGrobs')).toMatchObject({
      status: 'exists',
      reason: 'already_in_repo',
      existingPath: 'src/content/videos/agriculture/why-so-many-indian-farmers-want-to-quit.mdx',
    });
  });

  it('repeats nothing on a second run: no second PUT, no second Jev call', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    expect((await h.run()).committed).toBe(1);
    const second = await h.run();
    expect(second).toMatchObject({ newVideos: 0, classified: 0, committed: 0 });
    expect(h.world.github.puts).toHaveLength(1);
    expect(h.world.jev.requests).toHaveLength(1);
  });

  it('settles a waiting video as "exists" when an editor has added it by hand meanwhile', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    h.world.jev.script(GST_VIDEO.title, jevError(503, 'Overloaded'), jevError(503, 'Overloaded'), jevError(503, 'Overloaded'));
    await h.run();
    expect(h.kv.record(GST_VIDEO.id)).toMatchObject({ status: 'pending', attempts: 1 });

    h.world.github.files.set('src/content/videos/gst/gst-rates-explained.mdx', videoMdx('gst', 'GST rates, explained', GST_VIDEO.id));
    await h.run();
    expect(h.kv.record(GST_VIDEO.id)).toMatchObject({ status: 'exists', existingPath: 'src/content/videos/gst/gst-rates-explained.mdx' });
    expect(h.world.jev.requests).toHaveLength(3);
    expect(h.world.github.puts).toHaveLength(0);
  });
});

describe('when things fail', () => {
  it('keeps the classification when the write fails, and the next run commits without asking Jev again', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    h.world.github.putFailures = [500];

    const first = await h.run();
    expect(first).toMatchObject({ classified: 1, committed: 0, failed: 1 });
    expect(h.kv.record(GST_VIDEO.id)).toMatchObject({
      status: 'pending',
      attempts: 1,
      lastError: 'GitHub 500: Server Error',
      nextAttemptAt: '2026-10-22T07:00:00.000Z',
      classification: { topic: 'gst', outcome: 'confident' },
    });

    const second = await h.run();
    expect(second).toMatchObject({ classified: 0, committed: 1, failed: 0 });
    expect(h.world.jev.requests).toHaveLength(1);
    const record = h.kv.record(GST_VIDEO.id);
    expect(record).toMatchObject({ status: 'committed', attempts: 1, commit: { path: GST_PATH } });
    expect(record?.lastError).toBeUndefined();
    // The description is cleaned: no hashtags or links on the site.
    expect(readFrontmatter(h.world.github.files.get(GST_PATH) ?? '').description).toBe('Why the GST council keeps revising rates.');
  });

  it('backs off between attempts and marks a video failed after five', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    h.world.jev.script(GST_VIDEO.title, ...Array.from({ length: 30 }, () => jevError(500, 'Internal error')));

    const attempts: number[] = [];
    for (let run = 0; run < 7; run += 1) {
      await h.run();
      attempts.push(h.kv.record(GST_VIDEO.id)?.attempts ?? -1);
    }
    // Waits of 1, 2, 4 and 8 hours against a six-hourly cron: the fifth run
    // finds the video not yet due, the sixth makes the last attempt.
    expect(attempts).toEqual([1, 2, 3, 4, 4, 5, 5]);
    expect(h.kv.record(GST_VIDEO.id)).toMatchObject({ status: 'failed', lastError: 'OpenRouter 500: Internal error' });
    expect(h.kv.record(GST_VIDEO.id)?.nextAttemptAt).toBeUndefined();
    expect(h.world.jev.requests).toHaveLength(5 * 3);
  });

  it('retries malformed answers, then hands the video to a person', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    const unknownTopic = () => jevResponse({ choice: 'economics', confidence: 0.9, inScope: 0.9 });
    h.world.jev.script(GST_VIDEO.title, ...Array.from({ length: 5 }, unknownTopic));

    const first = await h.run();
    expect(first).toMatchObject({ classified: 0, failed: 1 });
    expect(h.kv.record(GST_VIDEO.id)).toMatchObject({
      status: 'pending',
      attempts: 1,
      lastError: 'malformed answer from Jev: answers.topic.choice "economics" is not one of the listed topics',
    });
    for (let run = 0; run < 6; run += 1) await h.run();
    expect(h.kv.record(GST_VIDEO.id)).toMatchObject({ status: 'needs_review', reason: 'malformed_response', attempts: 5 });
    expect(h.world.github.puts).toHaveLength(0);
    expect(h.world.jev.requests).toHaveLength(5);
  });

  it('stops the run on a rejected key without using up any video’s attempts', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO, { ...GST_VIDEO, id: 'NEWVIDEO002', title: 'Why Tax Cuts Rarely Pay for Themselves' }]);
    h.world.jev.script(GST_VIDEO.title, jevError(401, 'User not found.'));
    const summary = await h.run();
    expect(summary.errors).toEqual(['OpenRouter 401: User not found.; stopping this run']);
    expect(h.world.jev.requests).toHaveLength(1);
    expect(h.kv.record('NEWVIDEO001')).toMatchObject({ status: 'pending', attempts: 0 });
    expect(h.kv.record('NEWVIDEO002')).toMatchObject({ status: 'pending', attempts: 0 });
  });

  it('records a dead feed and stops cleanly, with nothing else touched', async () => {
    const h = createHarness();
    h.world.youtube.failures = Array<number>(8).fill(500);
    const summary = await h.run();
    expect(summary).toMatchObject({ feed: { ok: false, attempts: 8, entries: 0 }, newVideos: 0, subrequests: 8 });
    expect(summary.errors).toEqual([expect.stringContaining('the YouTube feed failed 8 times')]);
    expect(hosts(h.world.calls).every((host) => host === 'www.youtube.com')).toBe(true);
    expect(JSON.parse(h.kv.data.get('run:last') ?? 'null')).toMatchObject({ feed: { ok: false } });
    expect(h.kv.records()).toEqual([]);
    expect(h.kv.data.has('lock:run')).toBe(false);
    expect(h.sleeps.reduce((sum, ms) => sum + ms, 0)).toBeLessThan(15_000);
  });

  it('rides out a flaky feed within the run', async () => {
    const h = createHarness();
    h.world.youtube.failures = [404, 500];
    const summary = await h.run();
    expect(summary).toMatchObject({ feed: { ok: true, attempts: 3, entries: 15 }, committed: 4 });
  });

  it('does nothing at all without OPENROUTER_API_KEY', async () => {
    const h = createHarness();
    const summary = await h.run(testConfig(), { ...COMMIT_SECRETS, openrouterApiKey: undefined });
    expect(summary.errors).toEqual(['OPENROUTER_API_KEY is not set, so nothing can be classified']);
    expect(h.world.calls).toHaveLength(0);
  });

  it('keeps a config warning in the run summary', async () => {
    const h = createHarness();
    const { runSync } = await import('../src/run');
    const summary = await runSync(testConfig(), COMMIT_SECRETS, h.deps, 'manual', ['PUBLISH_MODE "yolo" is not "review" or "auto"; using "review"']);
    expect(summary.errors[0]).toBe('config: PUBLISH_MODE "yolo" is not "review" or "auto"; using "review"');
  });
});

describe('the safety interlock', () => {
  it('refuses to write to main, before any Jev call', async () => {
    const h = createHarness('main');
    const summary = await h.run(testConfig({ targetBranch: 'main' }));
    expect(summary.errors).toEqual([expect.stringMatching(/^Refusing to write to "main"\. .*ALLOW_MAIN/)]);
    expect(h.world.github.puts).toHaveLength(0);
    expect(h.world.jev.requests).toHaveLength(0);
  });

  it("refuses the repository's default branch, whatever it is called", async () => {
    const h = createHarness();
    h.world.github.defaultBranch = BRANCH;
    const summary = await h.run();
    expect(summary.errors).toEqual([expect.stringContaining("the repository's default branch")]);
    expect(h.world.github.puts).toHaveLength(0);
    expect(h.world.jev.requests).toHaveLength(0);
  });

  it('fails closed when the default branch cannot be looked up', async () => {
    const h = createHarness();
    h.world.github.metadataStatus = 500;
    const summary = await h.run();
    expect(summary.errors).toEqual(['run stopped: GitHub 500: Server Error']);
    expect(h.world.github.puts).toHaveLength(0);
    expect(h.world.jev.requests).toHaveLength(0);
  });

  it('writes to main only when ALLOW_MAIN is "true"', async () => {
    const h = createHarness('main');
    const summary = await h.run(testConfig({ targetBranch: 'main', allowMain: true }));
    expect(summary.committed).toBe(4);
    expect(h.world.github.puts.every((put) => put.branch === 'main')).toBe(true);
  });
});

describe('stage mode (no GITHUB_TOKEN)', () => {
  const READ_TOKEN = 'github-read-token-0000';

  it('keeps each would-be file in the ledger and never writes to GitHub', async () => {
    const h = createHarness();
    const summary = await h.run(testConfig(), STAGE_SECRETS);
    expect(summary).toMatchObject({ mode: 'stage', staged: 4, committed: 0 });

    const github = h.world.calls.filter((call) => call.url.startsWith('https://api.github.com/'));
    expect(github.every((call) => call.method === 'GET')).toBe(true);
    expect(github.every((call) => call.headers.authorization === undefined)).toBe(true);
    // No interlock lookup either: stage mode never writes.
    expect(github.some((call) => call.url === 'https://api.github.com/repos/CentreforCivilSociety-Academy/liberty-lighthouse')).toBe(false);

    const record = h.kv.record('kJhib23XYnU');
    expect(record).toMatchObject({
      status: 'staged',
      staged: { path: 'src/content/videos/pubc/why-spending-20-000-crore-might-not-help-the-economy.mdx', draft: true },
    });
    expect(readFrontmatter(record?.staged?.mdx ?? '')).toMatchObject({ youtubeId: 'kJhib23XYnU', topic: 'pubc', draft: true });
  });

  it('signs its reads with GITHUB_READ_TOKEN, and still never writes', async () => {
    const h = createHarness();
    const summary = await h.run(testConfig(), { ...STAGE_SECRETS, githubReadToken: READ_TOKEN });
    expect(summary).toMatchObject({ mode: 'stage', staged: 4, committed: 0, errors: [] });

    const github = h.world.calls.filter((call) => call.url.startsWith('https://api.github.com/'));
    expect(github.length).toBeGreaterThan(0);
    expect(github.every((call) => call.method === 'GET' && call.headers.authorization === `Bearer ${READ_TOKEN}`)).toBe(true);
    expect(h.world.github.puts).toEqual([]);
    expect([JSON.stringify(h.events), JSON.stringify(summary), ...h.kv.data.values()].join('\n')).not.toContain(READ_TOKEN);
  });

  it('uses GITHUB_TOKEN for every call once both tokens are set', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    const summary = await h.run(testConfig(), { ...COMMIT_SECRETS, githubReadToken: READ_TOKEN });
    expect(summary).toMatchObject({ mode: 'commit', committed: 1 });
    const github = h.world.calls.filter((call) => call.url.startsWith('https://api.github.com/'));
    expect(github.every((call) => call.headers.authorization === 'Bearer github-test-token-0000')).toBe(true);
  });

  it('leaves staged videos alone on later stage-mode runs', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    await h.run(testConfig(), STAGE_SECRETS);
    const again = await h.run(testConfig(), STAGE_SECRETS);
    expect(again).toMatchObject({ staged: 0, classified: 0 });
    expect(h.world.jev.requests).toHaveLength(1);
  });

  it('commits what it staged once a token is set, without asking Jev again', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    await h.run(testConfig(), STAGE_SECRETS);
    expect(h.kv.record(GST_VIDEO.id)?.status).toBe('staged');

    const activated = await h.run(testConfig(), COMMIT_SECRETS);
    expect(activated).toMatchObject({ mode: 'commit', committed: 1, classified: 0 });
    expect(h.world.jev.requests).toHaveLength(1);
    expect(h.world.github.puts.map((put) => put.path)).toEqual([GST_PATH]);
    expect(h.kv.record(GST_VIDEO.id)?.staged).toBeUndefined();
  });
});

describe('publish modes and outcomes', () => {
  const LOW = { ...GST_VIDEO, id: 'NEWVIDEO002', title: 'Why Factory Jobs Moved to Bangladesh', published: '2026-10-21T04:00:00+00:00' };

  it('in auto mode publishes a confident video and keeps a low-confidence one as a draft', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO, LOW]);
    h.world.jev.script(LOW.title, jevResponse({ choice: 'labor', confidence: 0.55, probabilities: { labor: 0.55, pubc: 0.4, gst: 0.05 }, inScope: 0.9 }));
    const summary = await h.run(testConfig({ publishMode: 'auto' }));
    expect(summary).toMatchObject({ committed: 2, classified: 2, needsReview: 1 });

    const [confident, uncertain] = h.world.github.puts;
    expect(readFrontmatter(confident?.content ?? '').draft).toBe(false);
    expect(confident?.content).not.toContain('Review the topic');
    expect(confident?.message).toContain('Status: published');

    expect(uncertain?.path).toBe('src/content/videos/labor/why-factory-jobs-moved-to-bangladesh.mdx');
    expect(readFrontmatter(uncertain?.content ?? '').draft).toBe(true);
    expect(uncertain?.content).toContain('# Topic: labor (confidence 0.55; runner-up pubc at 0.4)\n');
    expect(uncertain?.content).toContain('# Review the topic before publishing.\n');
    expect(uncertain?.message).toContain('Status: draft');
    expect(h.kv.record(LOW.id)).toMatchObject({ status: 'committed', reason: 'low_confidence', commit: { draft: true } });
  });

  it('in review mode keeps even a confident video as a draft', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    await h.run(testConfig({ publishMode: 'review' }));
    expect(readFrontmatter(h.world.github.files.get(GST_PATH) ?? '').draft).toBe(true);
  });

  it('writes no file for an out-of-scope video, and settles it for a person', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([{ ...GST_VIDEO, title: 'Join us live at the CCS annual summit' }]);
    h.world.jev.script('Join us live at the CCS annual summit', jevResponse({ choice: 'other', confidence: 0.8, inScope: 0.1 }));
    const summary = await h.run();
    expect(summary).toMatchObject({ classified: 1, needsReview: 1, committed: 0 });
    expect(h.world.github.puts).toHaveLength(0);
    expect(h.kv.record(GST_VIDEO.id)).toMatchObject({ status: 'needs_review', reason: 'out_of_scope', classification: { topic: 'other' } });
    await h.run();
    expect(h.world.jev.requests).toHaveLength(1);
  });

  it('writes a draft when Jev reports no confidence', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    h.world.jev.script(GST_VIDEO.title, jevResponse({ choice: 'gst', inScope: 0.95 }));
    await h.run(testConfig({ publishMode: 'auto' }));
    expect(h.kv.record(GST_VIDEO.id)).toMatchObject({ status: 'committed', reason: 'no_confidence', commit: { draft: true } });
    expect(h.world.github.files.get(GST_PATH)).toContain('# Topic: gst (confidence not reported)\n');
  });

  it('asks Jev again if the cached topic has since been removed from the branch', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    h.world.github.putFailures = [500];
    h.world.jev.script(GST_VIDEO.title, jevResponse({ choice: 'urban', confidence: 0.9, inScope: 0.9 }));
    await h.run();
    expect(h.kv.record(GST_VIDEO.id)?.classification?.topic).toBe('urban');

    h.world.github.files.delete('src/content/topics/urbanism.json');
    await h.run();
    expect(h.world.jev.requests).toHaveLength(2);
    expect(h.world.github.puts.map((put) => put.path)).toEqual([GST_PATH]);
  });
});

describe('when the path is taken', () => {
  it('treats a file holding the same video as done (another writer got there first)', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    h.world.github.unlisted.set(GST_PATH, videoMdx('gst', GST_VIDEO.title, GST_VIDEO.id));
    const summary = await h.run();
    expect(summary).toMatchObject({ committed: 0, failed: 0 });
    expect(h.kv.record(GST_VIDEO.id)).toMatchObject({ status: 'exists', existingPath: GST_PATH });
    expect(h.world.github.puts).toHaveLength(0);
  });

  it('gives a different video with the same title its own "-2" file', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    h.world.github.unlisted.set(GST_PATH, videoMdx('gst', GST_VIDEO.title, 'OTHERVIDEO1'));
    const summary = await h.run();
    expect(summary.committed).toBe(1);
    expect(h.world.github.puts.map((put) => put.path)).toEqual(['src/content/videos/gst/why-gst-rates-keep-changing-2.mdx']);
    expect(h.world.github.puts[0]?.message).toMatch(/^Create Video “gst\/why-gst-rates-keep-changing-2”/);
  });

  it('goes straight to "-2" when the listing already shows the slug taken', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    h.world.github.files.set(GST_PATH, videoMdx('gst', GST_VIDEO.title, 'OTHERVIDEO1'));
    await h.run();
    const writes = h.world.calls.filter((call) => call.method === 'PUT');
    expect(writes).toHaveLength(1);
    expect(h.world.github.puts.map((put) => put.path)).toEqual(['src/content/videos/gst/why-gst-rates-keep-changing-2.mdx']);
  });

  it('needs a person when "-2" is taken too', async () => {
    const h = createHarness();
    h.world.youtube.xml = buildFeed([GST_VIDEO]);
    h.world.github.unlisted.set(GST_PATH, videoMdx('gst', GST_VIDEO.title, 'OTHERVIDEO1'));
    h.world.github.unlisted.set('src/content/videos/gst/why-gst-rates-keep-changing-2.mdx', videoMdx('gst', GST_VIDEO.title, 'OTHERVIDEO2'));
    const summary = await h.run();
    expect(summary).toMatchObject({ committed: 0, failed: 1 });
    expect(h.kv.record(GST_VIDEO.id)?.lastError).toMatch(/both hold other videos; this one needs a filename chosen by hand$/);
  });
});

describe('the subrequest budget (50 on the free plan)', () => {
  function bigRepo(h: ReturnType<typeof createHarness>, extraVideos: number) {
    for (let i = 0; i < extraVideos; i += 1) {
      h.world.github.files.set(
        `src/content/videos/pubc/extra-${i}.mdx`,
        videoMdx('pubc', `Extra ${i}`, `EXTRAVID${String(i).padStart(3, '0')}`),
      );
    }
  }

  it('never starts a video it might not finish, and the next run picks up the rest', async () => {
    const h = createHarness();
    bigRepo(h, 25);
    h.world.youtube.failures = Array<number>(7).fill(500);
    // 8 feed attempts + 1 interlock + 1 tree + 29 video blobs + 7 topic blobs = 46,
    // leaving 4: less than the 7 one video can need (3 Jev + 4 GitHub).
    const first = await h.run();
    expect(first).toMatchObject({ subrequests: 46, classified: 0, committed: 0, errors: [] });
    expect(h.world.calls).toHaveLength(46);
    expect(h.world.jev.requests).toHaveLength(0);
    expect(h.events.some((event) => event.event === 'budget.stop')).toBe(true);
    expect(Object.values(h.kv.statuses()).filter((status) => status === 'pending')).toHaveLength(12);

    const second = await h.run();
    expect(second).toMatchObject({ committed: 4 });
    expect(second.subrequests).toBeLessThanOrEqual(50);
  });

  it('stops cleanly if the budget runs out while reading the repo, keeping what it read', async () => {
    const h = createHarness();
    bigRepo(h, 40);
    h.world.youtube.failures = Array<number>(7).fill(500);
    const first = await h.run();
    expect(first.subrequests).toBe(50);
    expect(h.world.calls).toHaveLength(50);
    expect(first.errors).toEqual(['all 50 subrequests for this invocation are used; the next run carries on from here']);
    expect(h.kv.data.has('lock:run')).toBe(false);

    const second = await h.run();
    expect(second).toMatchObject({ committed: 4, errors: [] });
    // Only the four video blobs and seven topic blobs not read last time.
    expect(h.world.github.blobReads).toHaveLength(40 + 4 + 7);
  });

  it('stays within the limit on every run of a long cold start', async () => {
    const h = createHarness();
    bigRepo(h, 20);
    for (let run = 0; run < 5; run += 1) {
      h.world.youtube.failures = Array<number>(7).fill(500);
      const summary = await h.run();
      expect(summary.subrequests).toBeLessThanOrEqual(50);
    }
    expect(h.world.github.puts).toHaveLength(12);
  });
});

describe('the run lock and history', () => {
  it('skips a run while another holds the lock, touching nothing', async () => {
    const h = createHarness();
    await h.kv.put('lock:run', '2026-10-22T05:59:00.000Z', { expirationTtl: 600 });
    const summary = await h.run();
    expect(summary.skipped).toBe('locked');
    expect(h.world.calls).toHaveLength(0);
    expect(h.kv.data.has('run:last')).toBe(false);
  });

  it('takes the lock with a ten-minute TTL and releases it when done', async () => {
    const h = createHarness();
    await h.run();
    expect(h.kv.writes[0]).toEqual({ key: 'lock:run', expirationTtl: 600 });
    expect(h.kv.data.has('lock:run')).toBe(false);
  });

  it('keeps the last 20 run summaries, newest first', async () => {
    const h = createHarness();
    for (let run = 0; run < 22; run += 1) await h.run();
    const history = JSON.parse(h.kv.data.get('run:history') ?? '[]') as Array<{ startedAt: string }>;
    expect(history).toHaveLength(20);
    expect(history[0]?.startedAt).toBe(JSON.parse(h.kv.data.get('run:last') ?? '{}').startedAt);
    expect((history[0]?.startedAt ?? '') > (history[19]?.startedAt ?? '')).toBe(true);
  });
});

describe('detection through the YouTube Data API', () => {
  it('lists uploads through the API when YOUTUBE_API_KEY is set, and never asks the feed', async () => {
    const h = createHarness();
    const summary = await h.run(testConfig(), API_SECRETS);

    expect(summary.feed).toEqual({ ok: true, source: 'api', attempts: 2, entries: 13 });
    expect(h.world.youtube.requests).toBe(0);
    expect(summary).toMatchObject({ newVideos: 13, classified: 4, committed: 4, errors: [] });
    expect(h.kv.record('lANiSBGrobs')?.status).toBe('exists');
    expect(h.kv.record('Xq3Vb9LmP0s')).toBeUndefined();
    expect(h.world.github.puts.map((put) => put.path)).toEqual([
      'src/content/videos/labor/competitive-wages-may-not-be-enough-to-attract-investment.mdx',
      'src/content/videos/education/why-more-school-funding-hasnt-fixed-indian-education.mdx',
      'src/content/videos/pubc/why-doing-less-made-india-richer.mdx',
      'src/content/videos/pubc/why-spending-20-000-crore-might-not-help-the-economy.mdx',
    ]);
    const spending = h.world.github.puts[3];
    expect(readFrontmatter(spending?.content ?? '')).toMatchObject({ format: 'short', orientation: 'vertical', youtubeId: 'kJhib23XYnU' });
    expect(spending?.message).toContain('YouTube: https://www.youtube.com/shorts/kJhib23XYnU\n');
    // 2 API calls + interlock + tree + 11 blobs + (Jev + PUT) for each of 4 videos.
    expect(summary.subrequests).toBe(2 + 1 + 1 + 11 + 4 * 2);
  });

  it('falls back to the RSS feed in the same run when the API answers 403 quotaExceeded', async () => {
    const h = createHarness();
    h.world.youtube.playlistQueue.push(() =>
      googleError(403, 'quotaExceeded', 'The request cannot be completed because you have exceeded your <a href="/youtube/v3/getting-started#quota">quota</a>.'),
    );
    const summary = await h.run(testConfig(), API_SECRETS);

    expect(summary.feed).toEqual({ ok: true, source: 'rss', attempts: 1, entries: 15 });
    expect(summary.errors).toEqual([
      'YouTube Data API unusable this run (playlistItems.list 403: quotaExceeded); reading the RSS feed instead',
    ]);
    expect(summary.committed).toBe(4);
    expect(h.world.youtube.apiRequests).toHaveLength(1);
    expect(h.world.youtube.requests).toBe(1);
    expect(h.events.find((event) => event.event === 'run.error')).toMatchObject({ level: 'warn' });
  });

  it('falls back to the feed when Google fails twice, within the subrequest budget', async () => {
    const h = createHarness();
    h.world.youtube.playlistQueue.push(
      () => googleError(500, 'backendError', 'Backend Error'),
      () => googleError(500, 'backendError', 'Backend Error'),
    );
    h.world.youtube.failures = Array<number>(7).fill(500);
    const summary = await h.run(testConfig(), API_SECRETS);
    expect(summary.feed).toEqual({ ok: true, source: 'rss', attempts: 8, entries: 15 });
    expect(summary.errors[0]).toContain('(playlistItems.list 500: backendError)');
    expect(summary.subrequests).toBeLessThanOrEqual(50);
    expect(h.world.calls).toHaveLength(summary.subrequests);
  });

  it('records the source in the summary: "rss" when there is no key', async () => {
    const h = createHarness();
    const summary = await h.run();
    expect(summary.feed.source).toBe('rss');
    expect(h.world.youtube.apiRequests).toHaveLength(0);
    expect(JSON.parse(h.kv.data.get('run:last') ?? '{}').feed.source).toBe('rss');
  });

  it('never lets the key into a log line, the ledger or a run summary', async () => {
    const h = createHarness();
    await h.run(testConfig(), API_SECRETS);
    // Next run, a runtime whose network errors quote the request, key and all.
    const quoteTheRequest = () => {
      throw new TypeError(`fetch failed: ${h.world.youtube.apiRequests[0] ?? ''} x-goog-api-key: ${API_KEY}`);
    };
    h.world.youtube.playlistQueue.push(quoteTheRequest, quoteTheRequest);
    const second = await h.run(testConfig(), API_SECRETS);
    expect(second.feed.source).toBe('rss');

    // The key really was sent, in its header on every request and never in a URL...
    expect(h.world.youtube.apiKeys).toEqual([API_KEY, API_KEY, API_KEY, API_KEY]);
    expect(h.world.youtube.apiRequests.some((url) => url.includes(API_KEY))).toBe(false);
    // ...and appears nowhere else: not in any log line, KV value or summary.
    const everything = [JSON.stringify(h.events), JSON.stringify(second), ...h.kv.data.values()].join('\n');
    expect(everything).not.toContain(API_KEY);
    expect(everything).not.toMatch(/key=AIza/);
  });
});
