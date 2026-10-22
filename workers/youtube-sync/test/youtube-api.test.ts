import { describe, expect, it } from 'vitest';
import { type FetchFn, SubrequestBudget, describeError } from '../src/http';
import {
  fetchUploads,
  formatFromHashtag,
  formatFromPlayer,
  parseIsoDuration,
  publicUploads,
  uploadsPlaylistId,
} from '../src/youtube-api';
import { API_KEY, FakeYouTube, googleError, hang, playlistItemsFixture, toCall } from './helpers';

const CHANNEL = 'UCF5Yih_yIqBwO0LX_qcdQgA';

function setup() {
  const youtube = new FakeYouTube();
  const events: Array<{ event: string; level: string } & Record<string, unknown>> = [];
  const sleeps: number[] = [];
  const budget = new SubrequestBudget(50);
  const fetch: FetchFn = budget.wrap(async (url, init) => youtube.handleApi(toCall(url, init), init));
  const go = (channelId = CHANNEL, key = API_KEY) =>
    fetchUploads(fetch, channelId, key, {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0.5,
      log: (event, fields, level) => {
        events.push({ event, level, ...fields });
      },
      timeoutMs: 50,
    });
  return { youtube, events, sleeps, budget, go };
}

/** A playlistItems.list item in the documented shape. */
function playlistItem(videoId: string, title: string, extra: { description?: string; privacy?: string; videoPublishedAt?: string | null } = {}) {
  const contentDetails: Record<string, unknown> = { videoId };
  if (extra.videoPublishedAt !== null) contentDetails.videoPublishedAt = extra.videoPublishedAt ?? '2026-10-20T04:00:00Z';
  return {
    kind: 'youtube#playlistItem',
    etag: `etag-${videoId}`,
    id: `item-${videoId}`,
    snippet: {
      publishedAt: '2026-10-20T04:00:05Z',
      channelId: CHANNEL,
      title,
      description: extra.description ?? '',
      thumbnails: {},
      channelTitle: 'TheCCSAcademy',
      playlistId: 'UUF5Yih_yIqBwO0LX_qcdQgA',
      position: 0,
      resourceId: { kind: 'youtube#video', videoId },
    },
    contentDetails,
    status: { privacyStatus: extra.privacy ?? 'public' },
  };
}

/** A videos.list item in the documented shape (embed sizes are strings, as the API sends 64-bit numbers). */
function videoItem(id: string, duration: string, width: number, height: number) {
  return {
    kind: 'youtube#video',
    etag: `etag-${id}`,
    id,
    contentDetails: { duration, dimension: '2d', definition: 'hd', caption: 'false', licensedContent: false, contentRating: {}, projection: 'rectangular' },
    player: {
      embedHtml: `<iframe width="${width}" height="${height}" src="//www.youtube.com/embed/${id}"></iframe>`,
      embedHeight: String(height),
      embedWidth: String(width),
    },
  };
}

describe('publicUploads, on a documented playlistItems.list response', () => {
  it('keeps the 13 public uploads, newest first, and drops the private and deleted placeholders', () => {
    const uploads = publicUploads(JSON.parse(playlistItemsFixture));
    expect(uploads).toHaveLength(13);
    const ids = uploads?.map((upload) => upload.videoId);
    expect(ids).not.toContain('Xq3Vb9LmP0s');
    expect(ids).not.toContain('dL7cQ2nWkzE');
    expect(uploads?.map((upload) => upload.title)).not.toEqual(expect.arrayContaining(['Private video']));
    expect(uploads?.[0]).toEqual({
      videoId: 'wQ9M95FK6l0',
      title: 'Why Economists Got Excited About a Tax Reform',
      published: '2026-08-31T04:41:18Z',
      description: expect.stringMatching(/^Before GST, every time a part changed hands/),
    });
  });

  it('drops unlisted uploads and unusable items, and falls back to snippet.publishedAt for the date', () => {
    const uploads = publicUploads({
      kind: 'youtube#playlistItemListResponse',
      items: [
        playlistItem('aaaaaaaaaaa', 'Unlisted one', { privacy: 'unlisted' }),
        playlistItem('bbbbbbbbbbb', '  Public,\n no  video date ', { videoPublishedAt: null }),
        playlistItem('bad-id', 'A bad id'),
        playlistItem('ccccccccccc', '   '),
        { kind: 'youtube#playlistItem', snippet: { title: 'No status' }, contentDetails: { videoId: 'ddddddddddd' } },
      ],
    });
    expect(uploads).toEqual([
      { videoId: 'bbbbbbbbbbb', title: 'Public, no video date', published: '2026-10-20T04:00:05Z', description: '' },
    ]);
  });

  it('returns null for a response without an items array', () => {
    expect(publicUploads({ kind: 'youtube#playlistItemListResponse' })).toBeNull();
    expect(publicUploads('not json')).toBeNull();
  });
});

describe('telling a Short from a video', () => {
  it.each<[string, number, number, 'short' | 'video']>([
    ['PT58S', 1000, 1778, 'short'],
    ['PT3M', 1000, 1778, 'short'],
    ['PT3M1S', 1000, 1778, 'video'],
    ['PT12M4S', 1000, 1778, 'video'],
    ['PT58S', 1000, 563, 'video'],
    ['PT58S', 1000, 1000, 'video'],
    ['P0D', 1000, 1778, 'video'],
  ])('%s at %ix%i is a %s', (duration, width, height, format) => {
    expect(formatFromPlayer({ duration, embedWidth: String(width), embedHeight: String(height) })).toBe(format);
  });

  it('reads the player size whether it comes as a string or a number, and says "video" when it is missing', () => {
    expect(formatFromPlayer({ duration: 'PT40S', embedWidth: 1000, embedHeight: 1778 })).toBe('short');
    expect(formatFromPlayer({ duration: 'PT40S', embedWidth: undefined, embedHeight: undefined })).toBe('video');
    expect(formatFromPlayer({ duration: 'forty seconds', embedWidth: '1000', embedHeight: '1778' })).toBe('video');
  });

  it.each<[string, number | null]>([
    ['PT15M33S', 933],
    ['PT1H2M3S', 3_723],
    ['P1DT2H', 93_600],
    ['PT58S', 58],
    ['PT3M', 180],
    ['P0D', 0],
    ['PT1.5S', 1.5],
    ['', null],
    ['P', null],
    ['PT', null],
    ['15:33', null],
    ['P1W', null],
  ])('parses the duration %j as %j seconds', (text, seconds) => {
    expect(parseIsoDuration(text)).toBe(seconds);
  });

  it('falls back to the #shorts hashtag only as a whole word', () => {
    expect(formatFromHashtag({ title: 'GST in 60 seconds #Shorts', description: '' })).toBe('short');
    expect(formatFromHashtag({ title: 'GST', description: 'A quick one. #shorts #india' })).toBe('short');
    expect(formatFromHashtag({ title: 'Short sellers', description: '#shortselling explained' })).toBe('video');
  });

  it('turns a channel id into its uploads playlist id', () => {
    expect(uploadsPlaylistId('UCF5Yih_yIqBwO0LX_qcdQgA')).toBe('UUF5Yih_yIqBwO0LX_qcdQgA');
    expect(uploadsPlaylistId('@TheCCSAcademy')).toBeNull();
  });
});

describe('fetchUploads', () => {
  it('lists the uploads with two requests, exactly as documented', async () => {
    const { youtube, budget, go } = setup();
    const result = await go();
    expect(result).toMatchObject({ ok: true, requests: 2 });
    expect(budget.used).toBe(2);
    const entries = result.ok ? result.entries : [];
    expect(entries).toHaveLength(13);
    expect(entries.every((entry) => entry.format === 'short')).toBe(true);
    expect(entries[0]).toEqual({
      videoId: 'wQ9M95FK6l0',
      title: 'Why Economists Got Excited About a Tax Reform',
      published: '2026-08-31T04:41:18Z',
      description: expect.stringMatching(/^Before GST/),
      format: 'short',
      url: 'https://www.youtube.com/shorts/wQ9M95FK6l0',
    });

    const [playlist, videos] = youtube.apiRequests.map((url) => new URL(url));
    expect(playlist?.origin + (playlist?.pathname ?? '')).toBe('https://www.googleapis.com/youtube/v3/playlistItems');
    expect(Object.fromEntries(playlist?.searchParams ?? [])).toEqual({
      part: 'snippet,contentDetails,status',
      maxResults: '15',
      playlistId: 'UUF5Yih_yIqBwO0LX_qcdQgA',
    });
    expect(videos?.pathname).toBe('/youtube/v3/videos');
    expect(Object.fromEntries(videos?.searchParams ?? [])).toEqual({
      part: 'contentDetails,player',
      maxWidth: '1000',
      id: entries.map((entry) => entry.videoId).join(','),
    });
  });

  it('sends the key in the X-Goog-Api-Key header and never in a URL', async () => {
    // Google's API-key guidance: the header is the way to send a key; key=
    // in the query string exposes it to anything that records URLs.
    const { youtube, go } = setup();
    await go();
    expect(youtube.apiKeys).toEqual([API_KEY, API_KEY]);
    expect(youtube.apiRequests.some((url) => url.includes(API_KEY) || new URL(url).searchParams.has('key'))).toBe(false);
  });

  it('files a horizontal video and a long vertical one as videos, with watch URLs', async () => {
    const { youtube, go } = setup();
    youtube.videos.items = youtube.videos.items.map((item) =>
      item.id === 'wQ9M95FK6l0'
        ? videoItem(item.id, 'PT8M12S', 1000, 563)
        : item.id === 'Zac758HPfjg'
          ? videoItem(item.id, 'PT4M', 1000, 1778)
          : item,
    );
    const result = await go();
    const byId = new Map((result.ok ? result.entries : []).map((entry) => [entry.videoId, entry]));
    expect(byId.get('wQ9M95FK6l0')).toMatchObject({ format: 'video', url: 'https://www.youtube.com/watch?v=wQ9M95FK6l0' });
    expect(byId.get('Zac758HPfjg')).toMatchObject({ format: 'video', url: 'https://www.youtube.com/watch?v=Zac758HPfjg' });
    expect(byId.get('Fip-j7Uqbh0')).toMatchObject({ format: 'short', url: 'https://www.youtube.com/shorts/Fip-j7Uqbh0' });
  });

  it('falls back to the #shorts hashtag when videos.list fails, and says so', async () => {
    const { youtube, events, go } = setup();
    youtube.playlist.items = [
      playlistItem('aaaaaaaaaaa', 'GST in a minute', { description: 'Tax on tax, explained. #shorts' }),
      playlistItem('bbbbbbbbbbb', 'A long talk on federalism', { description: 'Recorded at our annual conference.' }),
    ];
    youtube.videosQueue.push(
      () => googleError(500, 'backendError', 'Backend Error'),
      () => googleError(500, 'backendError', 'Backend Error'),
    );
    const result = await go();
    expect(result).toMatchObject({ ok: true, requests: 3 });
    expect((result.ok ? result.entries : []).map((entry) => [entry.videoId, entry.format])).toEqual([
      ['aaaaaaaaaaa', 'short'],
      ['bbbbbbbbbbb', 'video'],
    ]);
    expect(events.map((event) => event.event)).toEqual(['youtube.retry', 'youtube.format_fallback']);
    expect(events[1]).toMatchObject({ level: 'warn', reason: 'videos.list 500: backendError', videos: 2 });
  });

  it('uses the hashtag only for a video that videos.list leaves out', async () => {
    const { youtube, events, go } = setup();
    youtube.videos.items = youtube.videos.items.filter((item) => item.id !== 'wQ9M95FK6l0');
    const result = await go();
    const formats = (result.ok ? result.entries : []).map((entry) => entry.format);
    expect(formats[0]).toBe('video');
    expect(formats.slice(1).every((format) => format === 'short')).toBe(true);
    expect(events).toEqual([expect.objectContaining({ event: 'youtube.format_fallback', videos: 1 })]);
  });

  it('retries a 5xx once, after a short pause', async () => {
    const { youtube, sleeps, go } = setup();
    youtube.playlistQueue.push(() => googleError(503, 'backendError', 'The service is currently unavailable.'));
    expect(await go()).toMatchObject({ ok: true, requests: 3 });
    expect(sleeps).toEqual([375]);
  });

  it('gives up after two timeouts', async () => {
    const { youtube, go } = setup();
    youtube.playlistQueue.push(
      (init) => hang(init),
      (init) => hang(init),
    );
    expect(await go()).toEqual({ ok: false, reason: 'playlistItems.list: no response within 0.05s', requests: 2 });
  });

  it('returns at once on 403 quotaExceeded, naming only the reason', async () => {
    const { youtube, sleeps, go } = setup();
    youtube.playlistQueue.push(() =>
      googleError(403, 'quotaExceeded', 'The request cannot be completed because you have exceeded your <a href="/youtube/v3/getting-started#quota">quota</a>.'),
    );
    expect(await go()).toEqual({ ok: false, reason: 'playlistItems.list 403: quotaExceeded', requests: 1 });
    expect(sleeps).toEqual([]);
  });

  it('names a rejected key by its reason codes', async () => {
    const { go } = setup();
    expect(await go(CHANNEL, 'AIzaSyWRONG-key-000000000000000000000000')).toEqual({
      ok: false,
      reason: 'playlistItems.list 400: badRequest (API_KEY_INVALID)',
      requests: 1,
    });
  });

  it("never repeats the URL, the key or Google's message text", async () => {
    const { youtube, events, go } = setup();
    youtube.playlistQueue.push(() =>
      googleError(
        403,
        'accessNotConfigured',
        'YouTube Data API v3 has not been used in project 123456 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=123456 then retry.',
      ),
    );
    expect(await go()).toEqual({ ok: false, reason: 'playlistItems.list 403: accessNotConfigured', requests: 1 });

    // A runtime whose network errors quote the URL, key and all.
    youtube.playlistQueue.push(
      () => {
        throw new TypeError(`fetch failed: ${youtube.apiRequests[0]}`);
      },
      () => {
        throw new TypeError(`fetch failed: ${youtube.apiRequests[0]}`);
      },
    );
    const failed = await go();
    expect(failed).toEqual({ ok: false, reason: 'playlistItems.list: network error', requests: 2 });
    expect(JSON.stringify([failed, events])).not.toContain(API_KEY);
  });

  it('refuses a channel id it cannot turn into an uploads playlist, without a request', async () => {
    const { budget, go } = setup();
    expect(await go('@TheCCSAcademy')).toMatchObject({ ok: false, requests: 0 });
    expect(budget.used).toBe(0);
  });

  it('treats an empty uploads playlist as an empty answer, without a second call', async () => {
    const { youtube, go } = setup();
    youtube.playlist.items = [];
    expect(await go()).toEqual({ ok: true, entries: [], requests: 1 });
  });
});

describe('describeError', () => {
  it('blanks a key= parameter wherever a message quotes a URL', () => {
    const error = new TypeError(
      `fetch failed: https://www.googleapis.com/youtube/v3/videos?part=player&key=${API_KEY}&id=abc`,
    );
    expect(describeError(error)).toBe(
      'fetch failed: https://www.googleapis.com/youtube/v3/videos?part=player&key=[redacted]&id=abc',
    );
  });
});
