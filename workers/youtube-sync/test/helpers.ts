/**
 * Fakes for everything outside the Worker: KV, YouTube (the RSS feed and the
 * Data API), GitHub's REST API and OpenRouter's Decisions API, routed by one
 * fetch function. Each fake records what it was asked, so tests can assert on
 * the calls (no Jev request, no PUT) as well as on the outcome.
 */

import type { Config, Secrets } from '../src/config';
import type { FetchFn } from '../src/http';
import { DECISIONS_URL } from '../src/jev';
import type { KvStore, VideoRecord } from '../src/ledger';
import { type RunDeps, runSync } from '../src/run';
import feedFixture from './fixtures/ccs-feed.xml?raw';
import playlistItemsFixture from './fixtures/youtube-api/playlist-items.json?raw';
import videosFixture from './fixtures/youtube-api/videos.json?raw';

export { feedFixture, playlistItemsFixture, videosFixture };

/** A fake YouTube Data API key, shaped like a real one (39 characters). */
export const API_KEY = 'AIzaSyTEST-fake-key-0000000000000000000';

export const REPO = 'CentreforCivilSociety-Academy/liberty-lighthouse';
export const BRANCH = 'feat/liberty-lighthouse-redesign-automation';

export class MemoryKv implements KvStore {
  readonly data = new Map<string, string>();
  /** Every put, in order, with its TTL. */
  readonly writes: Array<{ key: string; expirationTtl: number | undefined }> = [];

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.data.set(key, value);
    this.writes.push({ key, expirationTtl: options?.expirationTtl });
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(options: { prefix: string }): Promise<{ keys: { name: string }[]; list_complete: boolean }> {
    const keys = [...this.data.keys()].filter((key) => key.startsWith(options.prefix)).sort();
    return { keys: keys.map((name) => ({ name })), list_complete: true };
  }

  record(videoId: string): VideoRecord | undefined {
    const text = this.data.get(`video:${videoId}`);
    return text === undefined ? undefined : (JSON.parse(text) as VideoRecord);
  }

  records(): VideoRecord[] {
    return [...this.data.entries()]
      .filter(([key]) => key.startsWith('video:'))
      .map(([, value]) => JSON.parse(value) as VideoRecord);
  }

  statuses(): Record<string, string> {
    return Object.fromEntries(this.records().map((record) => [record.videoId, record.status]));
  }
}

export interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | undefined;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

export function toCall(url: string, init: RequestInit | undefined): Call {
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => {
    headers[key] = value;
  });
  return { method: init?.method ?? 'GET', url, headers, body: typeof init?.body === 'string' ? init.body : undefined };
}

export type Responder = (init: RequestInit | undefined) => Response | Promise<Response>;

/**
 * An error in the shape the YouTube Data API sends: Google's standard error
 * envelope, with the newer `details` entry when a detail reason is given (an
 * invalid key comes back as reason "badRequest" plus "API_KEY_INVALID").
 */
export function googleError(code: number, reason: string, message: string, detailReason?: string): Response {
  const error: Record<string, unknown> = {
    code,
    message,
    errors: [{ message, domain: reason === 'quotaExceeded' ? 'youtube.quota' : 'global', reason }],
  };
  if (detailReason) {
    error.status = code === 400 ? 'INVALID_ARGUMENT' : 'PERMISSION_DENIED';
    error.details = [
      {
        '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
        reason: detailReason,
        domain: 'googleapis.com',
        metadata: { service: 'youtube.googleapis.com' },
      },
    ];
  }
  return json({ error }, code);
}

/**
 * YouTube: the RSS feed, and the two Data API calls the sync makes. The API
 * answers with the documented-shape fixtures in test/fixtures/youtube-api,
 * built from the real feed's videos (13 public uploads plus a private and a
 * deleted placeholder), and refuses any request whose parameters differ from
 * the documented ones, so a changed request fails loudly.
 */
export class FakeYouTube {
  /** RSS: statuses for the next requests; once they run out, every request gets the feed. */
  failures: number[] = [];
  requests = 0;
  /** Data API requests as full URLs. The key travels in a header, so it is never in these. */
  readonly apiRequests: string[] = [];
  /** The X-Goog-Api-Key header of each Data API request, in order. */
  readonly apiKeys: Array<string | null> = [];
  /** Responses for the next playlistItems.list / videos.list calls; once used up, the fixtures answer. */
  readonly playlistQueue: Responder[] = [];
  readonly videosQueue: Responder[] = [];
  playlist: { items: Array<Record<string, unknown>> } & Record<string, unknown> = JSON.parse(playlistItemsFixture);
  videos: { items: Array<{ id: string } & Record<string, unknown>> } & Record<string, unknown> = JSON.parse(videosFixture);

  constructor(public xml: string = feedFixture) {}

  handle(): Response {
    this.requests += 1;
    const status = this.failures.shift();
    if (status !== undefined) return new Response('<html><body>Error</body></html>', { status });
    return new Response(this.xml, { status: 200, headers: { 'content-type': 'text/xml; charset=UTF-8' } });
  }

  handleApi(call: Call, init: RequestInit | undefined): Response | Promise<Response> {
    this.apiRequests.push(call.url);
    const key = new Headers(init?.headers).get('x-goog-api-key');
    this.apiKeys.push(key);
    const url = new URL(call.url);
    const params = url.searchParams;
    // Like Google: the key may come in the header (preferred) or as key=.
    if ((key ?? params.get('key')) !== API_KEY) {
      return googleError(400, 'badRequest', 'API key not valid. Please pass a valid API key.', 'API_KEY_INVALID');
    }
    if (url.pathname === '/youtube/v3/playlistItems') {
      const expected =
        params.get('part') === 'snippet,contentDetails,status' &&
        params.get('maxResults') === '15' &&
        params.get('playlistId') === 'UUF5Yih_yIqBwO0LX_qcdQgA';
      if (!expected) return googleError(400, 'invalidParameter', 'Unexpected playlistItems.list parameters');
      const next = this.playlistQueue.shift();
      return next ? next(init) : json(this.playlist);
    }
    if (url.pathname === '/youtube/v3/videos') {
      const expected = params.get('part') === 'contentDetails,player' && params.get('maxWidth') === '1000';
      if (!expected) return googleError(400, 'invalidParameter', 'Unexpected videos.list parameters');
      const next = this.videosQueue.shift();
      if (next) return next(init);
      const ids = new Set((params.get('id') ?? '').split(','));
      const items = this.videos.items.filter((item) => ids.has(item.id));
      return json({ ...this.videos, items, pageInfo: { totalResults: items.length, resultsPerPage: items.length } });
    }
    return googleError(404, 'notFound', 'Not Found');
  }
}

export interface Put {
  path: string;
  content: string;
  message: string;
  branch: unknown;
  committer: unknown;
  hasSha: boolean;
  authorization: string | undefined;
}

/**
 * A repository on one branch. Blob SHAs are content-addressed, as in git,
 * so editing a file gives it a new SHA and invalidates the sync's cache.
 */
export class FakeGitHub {
  readonly files = new Map<string, string>();
  /** Files on the branch that the tree listing does not show: another writer got there after we listed. */
  readonly unlisted = new Map<string, string>();
  readonly puts: Put[] = [];
  readonly blobReads: string[] = [];
  defaultBranch = 'main';
  /** The status of GET /repos/{repo}, which the interlock reads for the default branch. */
  metadataStatus = 200;
  /** Statuses to answer the next PUTs with, before behaving normally. */
  putFailures: number[] = [];
  private readonly shaByContent = new Map<string, string>();
  private readonly contentBySha = new Map<string, string>();

  constructor(readonly branch: string = BRANCH) {}

  shaOf(content: string): string {
    let sha = this.shaByContent.get(content);
    if (!sha) {
      sha = (this.shaByContent.size + 1).toString(16).padStart(40, '0');
      this.shaByContent.set(content, sha);
      this.contentBySha.set(sha, content);
    }
    return sha;
  }

  handle(call: Call): Response {
    const url = new URL(call.url);
    const prefix = `/repos/${REPO}`;
    if (!url.pathname.startsWith(prefix)) return json({ message: 'Not Found' }, 404);
    const path = url.pathname.slice(prefix.length);

    if (call.method === 'GET' && path === '') {
      if (this.metadataStatus !== 200) return json({ message: 'Server Error' }, this.metadataStatus);
      return json({ full_name: REPO, default_branch: this.defaultBranch });
    }

    if (call.method === 'GET' && path === `/git/trees/${encodeURIComponent(this.branch)}`) {
      if (url.searchParams.get('recursive') === null) return json({ message: 'expected recursive' }, 400);
      const tree = [
        { path: 'src', mode: '040000', type: 'tree', sha: 'f'.repeat(40) },
        ...[...this.files].map(([filePath, content]) => ({
          path: filePath,
          mode: '100644',
          type: 'blob',
          sha: this.shaOf(content),
          size: content.length,
        })),
      ];
      return json({ sha: 'e'.repeat(40), tree, truncated: false });
    }

    const blob = /^\/git\/blobs\/([0-9a-f]{40})$/.exec(path);
    if (call.method === 'GET' && blob?.[1]) {
      const content = this.contentBySha.get(blob[1]);
      this.blobReads.push(blob[1]);
      return content === undefined ? json({ message: 'Not Found' }, 404) : new Response(content);
    }

    const contents = /^\/contents\/(.+)$/.exec(path);
    if (contents?.[1]) {
      const filePath = decodeURIComponent(contents[1]);
      const existing = this.files.get(filePath) ?? this.unlisted.get(filePath);
      if (call.method === 'GET') {
        if (url.searchParams.get('ref') !== this.branch) return json({ message: 'No commit found for the ref' }, 404);
        return existing === undefined ? json({ message: 'Not Found' }, 404) : new Response(existing);
      }
      if (call.method === 'PUT') {
        const body = JSON.parse(call.body ?? '{}') as Record<string, unknown>;
        const failure = this.putFailures.shift();
        if (failure !== undefined) return json({ message: 'Server Error' }, failure);
        if (body.branch !== this.branch) return json({ message: `Branch ${String(body.branch)} not found` }, 404);
        if (existing !== undefined) return json({ message: 'Invalid request.\n\n"sha" wasn\'t supplied.' }, 422);
        const content = decodeBase64(String(body.content));
        this.files.set(filePath, content);
        this.puts.push({
          path: filePath,
          content,
          message: String(body.message),
          branch: body.branch,
          committer: body.committer,
          hasSha: 'sha' in body,
          authorization: call.headers.authorization,
        });
        const commitSha = `c${String(this.puts.length).padStart(39, '0')}`;
        return json(
          {
            content: { path: filePath, sha: this.shaOf(content) },
            commit: { sha: commitSha, html_url: `https://github.com/${REPO}/commit/${commitSha}` },
          },
          201,
        );
      }
    }
    return json({ message: 'Not Found' }, 404);
  }
}

function decodeBase64(text: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(text), (char) => char.charCodeAt(0)));
}

export interface JevAnswer {
  choice: string;
  confidence?: number | null;
  probabilities?: Record<string, number>;
  inScope: number;
  model?: string;
  cost?: number;
}

export function jevResponse(answer: JevAnswer): Response {
  const topic: Record<string, unknown> = { type: 'choice', choice: answer.choice };
  if (answer.confidence !== undefined) topic.confidence = answer.confidence;
  if (answer.probabilities) topic.probabilities = answer.probabilities;
  return json({
    id: 'gen-test',
    model: answer.model ?? 'typesafe/jev-1.14-20261014',
    provider: 'TypeSafe',
    answers: { topic, in_scope: { type: 'noul', noul: answer.inScope } },
    usage: { input_tokens: 600, output_tokens: 0, cost: answer.cost ?? 0.0000252 },
  });
}

export function jevError(status: number, message: string, metadata: unknown = null, headers: Record<string, string> = {}): Response {
  return json({ error: { code: status, message, metadata } }, status, headers);
}

/** A request that never answers until it is aborted, like an upstream that has hung. */
export function hang(init: RequestInit | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
  });
}

interface JevRequest {
  model: string;
  state: { title: string; description: string; format: string; published: string };
  questions: Record<string, { type: string; instructions: string; criteria: Record<string, string> }>;
  [key: string]: unknown;
}

/**
 * Jev, scripted per video title. Unscripted titles get a confident answer
 * from a simple keyword rule, which is enough to tell the topics apart.
 */
export class FakeJev {
  readonly requests: Array<{ body: JevRequest; headers: Record<string, string> }> = [];
  readonly scripted = new Map<string, Array<(init: RequestInit | undefined) => Response | Promise<Response>>>();

  script(title: string, ...responses: Array<Response | ((init: RequestInit | undefined) => Response | Promise<Response>)>): void {
    this.scripted.set(
      title,
      responses.map((response) => (typeof response === 'function' ? response : () => response)),
    );
  }

  handle(call: Call, init: RequestInit | undefined): Response | Promise<Response> {
    const body = JSON.parse(call.body ?? '{}') as JevRequest;
    this.requests.push({ body, headers: call.headers });
    const next = this.scripted.get(body.state.title)?.shift();
    if (next) return next(init);
    return jevResponse({ choice: guessTopic(body.state.title), confidence: 0.91, inScope: 0.96 });
  }

  titles(): string[] {
    return this.requests.map((request) => request.body.state.title);
  }
}

function guessTopic(title: string): string {
  if (/GST|Tax/i.test(title)) return 'gst';
  if (/School|Teacher|Education/i.test(title)) return 'education';
  if (/Wage|Overtime|Investment|Factor/i.test(title)) return 'labor';
  return 'pubc';
}

export interface World {
  fetch: FetchFn;
  calls: Call[];
  youtube: FakeYouTube;
  github: FakeGitHub;
  jev: FakeJev;
}

export function createWorld(branch: string = BRANCH): World {
  const youtube = new FakeYouTube();
  const github = new FakeGitHub(branch);
  const jev = new FakeJev();
  seedRepository(github);
  const calls: Call[] = [];
  const fetch: FetchFn = async (url, init) => {
    const call = toCall(url, init);
    calls.push(call);
    if (url.startsWith('https://www.youtube.com/feeds/videos.xml')) return youtube.handle();
    if (url.startsWith('https://www.googleapis.com/youtube/v3/')) return youtube.handleApi(call, init);
    if (url.startsWith('https://api.github.com/')) return github.handle(call);
    if (url === DECISIONS_URL) return jev.handle(call, init);
    throw new Error(`unexpected request: ${call.method} ${url}`);
  };
  return { fetch, calls, youtube, github, jev };
}

const topicJson = (title: string, slug: string, description: string, order: number) =>
  JSON.stringify({ order, guidedSyllabus: '', title, slug, description }, null, 2);

export const videoMdx = (topic: string, title: string, youtubeId: string) =>
  [
    '---',
    `topic: ${topic}`,
    `title: ${title}`,
    `youtubeId: ${youtubeId}`,
    'format: short',
    'orientation: vertical',
    'description: An existing video.',
    'order: 1',
    'draft: false',
    '---',
    '',
  ].join('\n');

/**
 * A slice of the real repository: topic files whose filenames differ from
 * their slugs, a description with the stray double space the CMS leaves,
 * three videos that are also in the feed fixture, and files the sync must
 * ignore.
 */
export function seedRepository(github: FakeGitHub): void {
  const topics: Array<[string, string, string, string]> = [
    ['agriculture.json', 'Agriculture', 'agriculture', 'Understanding agricultural policy in India through the lens of free markets.'],
    ['education.json', 'Education', 'education', 'Exploring market-based approaches to education reform in India.'],
    ['goods-and-services-tax.json', 'Goods and Services Tax', 'gst', "Understanding India's Goods and Services Tax and the economics behind it."],
    ['labour-and-manufacturing.json', 'Labour and manufacturing', 'labor', 'Understanding the bottlenecks to manufacturing and labour productivity growth in India'],
    ['property-rights.json', 'Property Rights', 'property', 'A  look into the importance of property rights and its evolution in India '],
    ['public-choice.json', 'Public Choice', 'pubc', 'Understanding why governments do what they do, from subsidies and stalled reforms to why good policies fail in practice'],
    ['urbanism.json', 'Urbanism', 'urban', 'Understanding Indian cities and urban governance.'],
  ];
  topics.forEach(([file, title, slug, description], index) => {
    github.files.set(`src/content/topics/${file}`, topicJson(title, slug, description, index + 1));
  });
  github.files.set('src/content/videos/agriculture/why-so-many-indian-farmers-want-to-quit.mdx', videoMdx('agriculture', 'Why So Many Indian Farmers Want to Quit', 'lANiSBGrobs'));
  github.files.set('src/content/videos/agriculture/why-india-stores-grain-it-cant-use.mdx', videoMdx('agriculture', "Why India Stores Grain It Can't Use", 'v209Etn-c24'));
  github.files.set('src/content/videos/pubc/why-good-policies-fail-even-when-theyre-sensible.mdx', videoMdx('pubc', "Why Good Policies Fail Even When They're Sensible", 'r6VCoPrI4h0'));
  github.files.set('src/content/videos/labor/indias-missed-manufacturing-boom.mdx', videoMdx('labor', "India's Missed Manufacturing Boom", 'B_edehvdfIM'));
  github.files.set('src/content/faqs/gst/what-is-gst.mdx', '---\nquestion: What is GST?\nyoutubeId: NOT-A-VIDEO\n---\n');
  github.files.set('README.md', '# Liberty Lighthouse\n');
}

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    channelId: 'UCF5Yih_yIqBwO0LX_qcdQgA',
    githubRepo: REPO,
    targetBranch: BRANCH,
    publishMode: 'review',
    jevModel: 'typesafe/jev-1.14',
    autoConfidence: 0.9,
    maxVideosPerRun: 4,
    allowMain: false,
    ...overrides,
  };
}

/** Fake credentials: the fakes check that they are sent, never that they are real. */
export const COMMIT_SECRETS: Secrets = {
  openrouterApiKey: 'sk-or-test-0000000000',
  githubToken: 'github-test-token-0000',
  adminToken: undefined,
  youtubeApiKey: undefined,
};

export const STAGE_SECRETS: Secrets = { ...COMMIT_SECRETS, githubToken: undefined };

/** Commit mode, detecting through the YouTube Data API. */
export const API_SECRETS: Secrets = { ...COMMIT_SECRETS, youtubeApiKey: API_KEY };

export interface Harness {
  world: World;
  kv: MemoryKv;
  clock: { now: Date };
  sleeps: number[];
  events: Array<{ event: string; level: string } & Record<string, unknown>>;
  deps: RunDeps;
  /** Run once, then move the clock on six hours, like the cron. */
  run(config?: Config, secrets?: Secrets): ReturnType<typeof runSync>;
}

export function createHarness(branch: string = BRANCH): Harness {
  const world = createWorld(branch);
  const kv = new MemoryKv();
  const clock = { now: new Date('2026-10-22T06:00:00Z') };
  const sleeps: number[] = [];
  const events: Harness['events'] = [];
  const deps: RunDeps = {
    fetch: world.fetch,
    kv,
    now: () => clock.now,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0.5,
    log: (event, fields, level) => {
      events.push({ event, level, ...fields });
    },
  };
  return {
    world,
    kv,
    clock,
    sleeps,
    events,
    deps,
    async run(config = testConfig(), secrets = COMMIT_SECRETS) {
      const summary = await runSync(config, secrets, deps, 'cron');
      clock.now = new Date(clock.now.getTime() + 6 * 60 * 60 * 1000);
      return summary;
    },
  };
}

export interface FeedVideo {
  id: string;
  title: string;
  description?: string;
  published: string;
  short?: boolean;
}

/** A feed in YouTube's exact shape, for tests that need specific videos. */
export function buildFeed(videos: FeedVideo[]): string {
  const escape = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const entries = videos.map((video) => {
    const link = video.short === false ? `https://www.youtube.com/watch?v=${video.id}` : `https://www.youtube.com/shorts/${video.id}`;
    return ` <entry>
  <id>yt:video:${video.id}</id>
  <yt:videoId>${video.id}</yt:videoId>
  <yt:channelId>UCF5Yih_yIqBwO0LX_qcdQgA</yt:channelId>
  <title>${escape(video.title)}</title>
  <link rel="alternate" href="${link}"/>
  <published>${video.published}</published>
  <media:group>
   <media:title>${escape(video.title)}</media:title>
   <media:description>${escape(video.description ?? `A short about ${video.title}.`)}</media:description>
  </media:group>
 </entry>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>TheCCSAcademy</title>
${entries.join('\n')}
</feed>
`;
}

/**
 * A reader for exactly the YAML subset mdx.ts writes (and Decap writes):
 * comment lines, `key: value` lines, two-space continuation lines, plain
 * scalars, double-quoted scalars with JSON-compatible escapes, booleans and
 * integers. It is deliberately not a YAML parser; the scratch check against
 * js-yaml lives outside the repo. It is enough to show that what we write
 * reads back as what we meant.
 */
export function readFrontmatter(mdx: string): Record<string, string | number | boolean> {
  const block = /^---\n([\s\S]*?)\n---\n/.exec(mdx)?.[1];
  if (block === undefined) throw new Error('no frontmatter block');
  const fields: Record<string, string | number | boolean> = {};
  let key: string | null = null;
  let parts: string[] = [];
  const flush = () => {
    if (key !== null) fields[key] = scalar(parts.join(' '));
  };
  for (const line of block.split('\n')) {
    if (line.startsWith('#')) continue;
    if (line.startsWith('  ')) {
      parts.push(line.trim());
      continue;
    }
    flush();
    const match = /^([A-Za-z]+): (.*)$/.exec(line);
    if (!match?.[1]) throw new Error(`not a key line: ${line}`);
    key = match[1];
    parts = [match[2] ?? ''];
  }
  flush();
  return fields;
}

function scalar(text: string): string | number | boolean {
  if (text.startsWith('"')) return JSON.parse(text) as string;
  if (text === 'true' || text === 'false') return text === 'true';
  if (/^-?\d+$/.test(text)) return Number(text);
  return text;
}
