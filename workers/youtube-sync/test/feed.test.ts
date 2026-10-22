import { describe, expect, it } from 'vitest';
import { FEED_ATTEMPTS, decodeXml, feedPause, fetchFeed, parseFeed } from '../src/feed';
import { type FetchFn, SubrequestBudget } from '../src/http';
import unrelatedFeed from './fixtures/unrelated-channel-feed.xml?raw';
import { FakeYouTube, buildFeed, feedFixture } from './helpers';

describe('parseFeed, on the real feed', () => {
  const entries = parseFeed(feedFixture);

  it('finds all 15 uploads, in the order YouTube lists them (newest first)', () => {
    expect(entries.map((entry) => entry.videoId)).toEqual([
      'wQ9M95FK6l0',
      'Zac758HPfjg',
      'Fip-j7Uqbh0',
      'zq7h9cU-ZMU',
      'eBkMjmGB7aU',
      '-q05TW2BXGs',
      'KjYBW-Uf-jg',
      'LPkrQOrwh10',
      'kJhib23XYnU',
      'LYoNBT1fT3I',
      'Uv8ToPbxju8',
      '-OnRbHarcMg',
      'lANiSBGrobs',
      'v209Etn-c24',
      'r6VCoPrI4h0',
    ]);
  });

  it('reads titles with ₹ and apostrophes intact, and never the channel title', () => {
    const titles = entries.map((entry) => entry.title);
    expect(titles).toContain('Why Spending ₹20,000 Crore Might Not Help the Economy');
    expect(titles).toContain("Why You Can Lose Money to Someone Else's GST Fraud");
    expect(titles).toContain("Why India Stores Grain It Can't Use");
    expect(titles).not.toContain('TheCCSAcademy');
  });

  it('marks every entry a Short, from its /shorts/ link', () => {
    expect(entries.every((entry) => entry.format === 'short')).toBe(true);
    expect(entries[0]).toMatchObject({
      url: 'https://www.youtube.com/shorts/wQ9M95FK6l0',
      published: '2026-08-31T04:41:18+00:00',
      title: 'Why Economists Got Excited About a Tax Reform',
    });
  });

  it('decodes entities in descriptions', () => {
    const trucks = entries.find((entry) => entry.videoId === 'eBkMjmGB7aU');
    expect(trucks?.description).toContain('India\'s "one nation, one market" promise');
    expect(trucks?.description).not.toContain('&quot;');
  });
});

describe('parseFeed, on the wrong channel', () => {
  // A real feed from @libertylighthouse, an unrelated liquor-brand channel
  // whose handle looks like this site's name. It is a perfectly good feed, so
  // nothing in the parser can tell a mistyped CHANNEL_ID from the right one.
  // What keeps such uploads off the site is decide.ts: in calibration all six
  // chose "other" with in-scope 0.3 or less, so they are settled as
  // out_of_scope and no file is written.
  const entries = parseFeed(unrelatedFeed);

  it('parses like any other feed: six regular videos with no policy content', () => {
    expect(entries.map((entry) => entry.videoId)).toEqual([
      'U7nau4OmYa4',
      'etbiU_dh8XE',
      'S9PFtYjJGcc',
      'j4TEF0QK25E',
      '7wgD2V7JGhk',
      'ngL862sPHp4',
    ]);
    expect(entries.every((entry) => entry.format === 'video')).toBe(true);
    expect(entries.map((entry) => entry.title)).toContain('Tequila Traveler Episode 2.mp4');
    expect(entries.map((entry) => entry.title)).not.toContain('libertylighthouse');
  });
});

describe('parseFeed, on awkward input', () => {
  it('decodes named and numeric entities in one pass', () => {
    expect(decodeXml('&amp;lt; &#39; &#x20B9; &#8377; &quot;&apos;&gt;')).toBe('&lt; \' ₹ ₹ "\'>');
  });

  it('leaves unknown and invalid references exactly as written', () => {
    expect(decodeXml('&nbsp; &#0; &#xD800; &#x110000; &bogus;')).toBe('&nbsp; &#0; &#xD800; &#x110000; &bogus;');
  });

  it('decodes titles, flattens their whitespace, and tells a regular video from a Short', () => {
    const [entry] = parseFeed(
      buildFeed([
        { id: 'abcdefghijk', title: 'Tax &   "Spend":\n Why ₹ Matters', published: '2026-10-01T00:00:00+00:00', short: false },
      ]),
    );
    expect(entry).toMatchObject({
      title: 'Tax & "Spend": Why ₹ Matters',
      format: 'video',
      url: 'https://www.youtube.com/watch?v=abcdefghijk',
    });
  });

  it('skips entries without a usable video id or title rather than guessing', () => {
    const xml = buildFeed([
      { id: 'abcdefghijk', title: 'A real one', published: '2026-10-01T00:00:00+00:00' },
      { id: 'too-short', title: 'Bad id', published: '2026-10-01T00:00:00+00:00' },
      { id: 'bcdefghijkl', title: '   ', published: '2026-10-01T00:00:00+00:00' },
    ]);
    expect(parseFeed(xml).map((entry) => entry.videoId)).toEqual(['abcdefghijk']);
  });
});

describe('fetchFeed', () => {
  function setup(fetchFn: FetchFn) {
    const sleeps: number[] = [];
    const budget = new SubrequestBudget(50);
    const result = fetchFeed(budget.wrap(fetchFn), 'UCF5Yih_yIqBwO0LX_qcdQgA', {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0.5,
    });
    return { sleeps, budget, result };
  }

  it('rides out the flakiness: a 404, a 500, then the feed', async () => {
    const youtube = new FakeYouTube();
    youtube.failures = [404, 500];
    const { result, sleeps } = setup(async () => youtube.handle());
    const feed = await result;
    expect(feed).toMatchObject({ ok: true, attempts: 3 });
    expect(feed.ok && feed.entries).toHaveLength(15);
    // 400 ms and 800 ms, each scaled by the jitter (0.75 at random() = 0.5).
    expect(sleeps).toEqual([300, 600]);
  });

  it('gives up after eight attempts with a clean error, having waited under 15 seconds', async () => {
    const youtube = new FakeYouTube();
    youtube.failures = Array<number>(FEED_ATTEMPTS).fill(500);
    const { result, sleeps, budget } = setup(async () => youtube.handle());
    expect(await result).toEqual({ ok: false, attempts: 8, error: expect.stringContaining('failed 8 times (last: HTTP 500)') });
    expect(budget.used).toBe(8);
    expect(sleeps).toHaveLength(7);
    expect(sleeps.reduce((sum, ms) => sum + ms, 0)).toBeLessThan(15_000);
  });

  it('keeps the total wait under 15 seconds even when the jitter is at its longest', () => {
    const pauses = Array.from({ length: FEED_ATTEMPTS - 1 }, (_, i) => feedPause(i + 1, () => 1));
    expect(pauses).toEqual([400, 800, 1600, 3000, 3000, 3000, 3000]);
    expect(pauses.reduce((sum, ms) => sum + ms, 0)).toBeLessThan(15_000);
  });

  it('treats a 200 that is not a feed as a failure, not as an empty channel', async () => {
    const bodies = ['<html>Before you continue to YouTube</html>', feedFixture];
    const { result } = setup(async () => new Response(bodies.shift(), { status: 200 }));
    expect(await result).toMatchObject({ ok: true, attempts: 2 });
  });

  it('retries network errors like any other failure', async () => {
    let calls = 0;
    const { result } = setup(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('fetch failed');
      return new Response(feedFixture);
    });
    expect(await result).toMatchObject({ ok: true, attempts: 2 });
  });

  it('asks for the channel by id, never following redirects', async () => {
    const seen: Array<{ url: string; redirect: unknown }> = [];
    const { result } = setup(async (url, init) => {
      seen.push({ url, redirect: init?.redirect });
      return new Response(feedFixture);
    });
    await result;
    expect(seen).toEqual([
      { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCF5Yih_yIqBwO0LX_qcdQgA', redirect: 'manual' },
    ]);
  });
});
