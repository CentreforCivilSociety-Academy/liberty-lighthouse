import { describe, expect, it } from 'vitest';
import { createGitHub } from '../src/github';
import { BudgetExhausted, type FetchFn, SubrequestBudget, UpstreamError } from '../src/http';
import { renderVideoMdx } from '../src/mdx';
import { extractYoutubeId, loadSnapshot, parseTopic } from '../src/repo';
import { BRANCH, MemoryKv, REPO, createWorld, videoMdx } from './helpers';

describe('parseTopic', () => {
  it("takes the folder name from the JSON's slug, not the filename", () => {
    const publicChoice = JSON.stringify({ order: 9, title: 'Public Choice', slug: 'pubc', description: 'Why governments do what they do' });
    expect(parseTopic(publicChoice)).toEqual({ slug: 'pubc', title: 'Public Choice', description: 'Why governments do what they do' });
  });

  it('normalises the stray spaces CMS descriptions carry', () => {
    const property = JSON.stringify({
      title: 'Property Rights',
      slug: 'property',
      description: 'A  look into the importance of property rights and its evolution in India ',
    });
    expect(parseTopic(property)?.description).toBe('A look into the importance of property rights and its evolution in India');
  });

  it.each([
    ['no slug', { title: 'T', description: 'D' }],
    ['an uppercase slug', { title: 'T', slug: 'GST', description: 'D' }],
    ['a slug that is a path', { title: 'T', slug: '../workflows', description: 'D' }],
    ['the reserved slug "other"', { title: 'Other', slug: 'other', description: 'D' }],
    ['no title', { slug: 'gst', description: 'D' }],
    ['an array', ['gst']],
  ])('refuses a topic with %s', (_name, data) => {
    expect(parseTopic(JSON.stringify(data))).toBeNull();
  });

  it('refuses a file that is not JSON', () => {
    expect(parseTopic('{ not json')).toBeNull();
  });
});

describe('extractYoutubeId', () => {
  it.each<[string, string, string | null]>([
    ['a plain value', '---\ntopic: gst\nyoutubeId: lANiSBGrobs\n---\n', 'lANiSBGrobs'],
    ['a double-quoted value', '---\nyoutubeId: "-q05TW2BXGs"\n---\n', '-q05TW2BXGs'],
    ['a single-quoted value', "---\nyoutubeId: '-OnRbHarcMg'\n---\n", '-OnRbHarcMg'],
    ['CRLF line endings', '---\r\ntopic: gst\r\nyoutubeId: abcdefghijk\r\n---\r\n', 'abcdefghijk'],
    ['no youtubeId', '---\ntopic: gst\n---\n', null],
    ['a youtubeId only in the body', '---\ntopic: gst\n---\nyoutubeId: abcdefghijk\n', null],
    ['no frontmatter', 'youtubeId: abcdefghijk\n', null],
  ])('reads %s', (_name, mdx, id) => {
    expect(extractYoutubeId(mdx)).toBe(id);
  });

  it('reads the files this Worker writes, provenance comments and all', () => {
    const mdx = renderVideoMdx(
      { topic: 'gst', title: 'A title', youtubeId: '-q05TW2BXGs', format: 'short', description: 'D', draft: true },
      { addedOn: '2026-10-22', model: 'm', topic: 'gst', confidence: 0.9, runnerUp: null, inScope: 0.9, draft: true },
    );
    expect(extractYoutubeId(mdx)).toBe('-q05TW2BXGs');
  });
});

describe('loadSnapshot', () => {
  function setup(limit = 50) {
    const world = createWorld();
    const budget = new SubrequestBudget(limit);
    const kv = new MemoryKv();
    const github = createGitHub({ http: budget.wrap(world.fetch), repo: REPO, branch: BRANCH, token: undefined });
    return { world, budget, kv, github };
  }

  it('lists the branch once and reads each video and topic file once', async () => {
    const { world, budget, kv, github } = setup();
    const snapshot = await loadSnapshot(github, kv);
    expect(budget.used).toBe(1 + 4 + 7);
    expect(snapshot.reads).toBe(11);
    expect(Object.fromEntries(snapshot.videos)).toEqual({
      lANiSBGrobs: 'src/content/videos/agriculture/why-so-many-indian-farmers-want-to-quit.mdx',
      'v209Etn-c24': 'src/content/videos/agriculture/why-india-stores-grain-it-cant-use.mdx',
      r6VCoPrI4h0: 'src/content/videos/pubc/why-good-policies-fail-even-when-theyre-sensible.mdx',
      B_edehvdfIM: 'src/content/videos/labor/indias-missed-manufacturing-boom.mdx',
    });
    // Slugs from the JSON (gst, labor, pubc...), sorted, never the filenames.
    expect(snapshot.topics.map((topic) => topic.slug)).toEqual(['agriculture', 'education', 'gst', 'labor', 'property', 'pubc', 'urban']);
    // The FAQ's youtubeId-looking line is outside src/content/videos.
    expect(snapshot.videos.has('NOT-A-VIDEO')).toBe(false);
    expect(world.calls[0]?.url).toBe(
      `https://api.github.com/repos/${REPO}/git/trees/feat%2Fliberty-lighthouse-redesign-automation?recursive=1`,
    );
  });

  it('answers from the KV cache next time, re-reading only files whose contents changed', async () => {
    const { world, budget, kv, github } = setup();
    await loadSnapshot(github, kv);
    const used = budget.used;
    const again = await loadSnapshot(github, kv);
    expect(budget.used - used).toBe(1);
    expect(again.reads).toBe(0);

    world.github.files.set(
      'src/content/topics/urbanism.json',
      JSON.stringify({ title: 'Urbanism', slug: 'urban', description: 'Cities, rewritten.' }),
    );
    const edited = await loadSnapshot(github, kv);
    expect(edited.reads).toBe(1);
    expect(edited.topics.find((topic) => topic.slug === 'urban')?.description).toBe('Cities, rewritten.');
  });

  it('skips unusable topic files with a warning, keeping the rest', async () => {
    const { world, kv, github } = setup();
    world.github.files.set('src/content/topics/broken.json', '{ "title": "Broken"');
    world.github.files.set('src/content/topics/duplicate.json', JSON.stringify({ title: 'Tax again', slug: 'gst', description: 'D' }));
    const snapshot = await loadSnapshot(github, kv);
    expect(snapshot.topics).toHaveLength(7);
    expect(snapshot.warnings).toEqual([
      expect.stringContaining('src/content/topics/broken.json is skipped'),
      expect.stringContaining('src/content/topics/duplicate.json is skipped: another topic already uses the slug "gst"'),
    ]);
  });

  it('refuses a truncated listing, because dedupe could not be trusted', async () => {
    const kv = new MemoryKv();
    const truncated: FetchFn = async () => new Response(JSON.stringify({ sha: 'x', tree: [], truncated: true }));
    const github = createGitHub({ http: truncated, repo: REPO, branch: BRANCH, token: undefined });
    await expect(loadSnapshot(github, kv)).rejects.toMatchObject({ fatal: true, message: expect.stringContaining('truncated') });
    await expect(loadSnapshot(github, kv)).rejects.toBeInstanceOf(UpstreamError);
  });

  it('saves what it read when the budget runs out part way, so the next run carries on', async () => {
    const { world, kv } = setup();
    for (let i = 0; i < 10; i += 1) {
      world.github.files.set(`src/content/videos/pubc/extra-${i}.mdx`, videoMdx('pubc', `Extra ${i}`, `EXTRAVID${String(i).padStart(3, '0')}`));
    }
    const tight = new SubrequestBudget(6);
    const first = createGitHub({ http: tight.wrap(world.fetch), repo: REPO, branch: BRANCH, token: undefined });
    await expect(loadSnapshot(first, kv)).rejects.toBeInstanceOf(BudgetExhausted);
    const cached = JSON.parse(kv.data.get('cache:video-ids') ?? '{}') as Record<string, string | null>;
    expect(Object.keys(cached)).toHaveLength(5);

    const roomy = new SubrequestBudget(50);
    const second = createGitHub({ http: roomy.wrap(world.fetch), repo: REPO, branch: BRANCH, token: undefined });
    const snapshot = await loadSnapshot(second, kv);
    expect(snapshot.reads).toBe(14 - 5 + 7);
    expect(snapshot.videos.size).toBe(14);
  });

  it('sends the token when there is one, and none in stage mode', async () => {
    const { world, kv } = setup();
    await loadSnapshot(createGitHub({ http: world.fetch, repo: REPO, branch: BRANCH, token: undefined }), kv);
    expect(world.calls.every((call) => call.headers.authorization === undefined)).toBe(true);
    const before = world.calls.length;
    await loadSnapshot(createGitHub({ http: world.fetch, repo: REPO, branch: BRANCH, token: 'github-test-token-0000' }), kv);
    expect(world.calls.slice(before).map((call) => call.headers.authorization)).toEqual(['Bearer github-test-token-0000']);
    for (const call of world.calls) {
      expect(call.headers['x-github-api-version']).toBe('2022-11-28');
      expect(call.headers['user-agent']).toBe('liberty-lighthouse-youtube-sync');
    }
  });
});
