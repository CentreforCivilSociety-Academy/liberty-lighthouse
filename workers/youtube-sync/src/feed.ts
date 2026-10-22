/**
 * Detect: the channel's public Atom feed.
 *
 * The feed needs no API key and lists the channel's 15 most recent uploads.
 * It is also unreliable. In our measurements only 20 to 30 percent of
 * requests got a 200; the rest got a 404 or a 500 at random, with no
 * pattern in time or frequency. A failed request says nothing about the
 * channel, so we simply ask again: up to eight times, with short jittered
 * pauses that add up to between 7 and 15 seconds. If every attempt fails,
 * the run records it and stops. Nothing is lost, because the next run reads
 * the same 15 uploads.
 */

import { type FetchFn, UpstreamError, jitter, request } from './http';
import { normaliseText } from './text';

export const FEED_ATTEMPTS = 8;
const FEED_TIMEOUT_MS = 10_000;
const FIRST_PAUSE_MS = 400;
const LONGEST_PAUSE_MS = 3_000;

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export interface FeedEntry {
  videoId: string;
  title: string;
  /** As the feed gives it, e.g. 2026-08-31T04:41:18+00:00. */
  published: string;
  /** The alternate link: /shorts/<id> for a Short, /watch?v=<id> otherwise. */
  url: string;
  /** Entity-decoded but otherwise as uploaded; cleaned where it is used. */
  description: string;
  format: 'short' | 'video';
}

export type FeedResult =
  | { ok: true; attempts: number; entries: FeedEntry[] }
  | { ok: false; attempts: number; error: string };

export interface FeedOptions {
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  onAttemptFailed?: (attempt: number, reason: string) => void;
}

export function feedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

/** The pause after attempt n: 400 ms, doubling to a 3 s ceiling, then jittered. */
export function feedPause(attempt: number, random: () => number): number {
  return jitter(Math.min(LONGEST_PAUSE_MS, FIRST_PAUSE_MS * 2 ** (attempt - 1)), random);
}

export async function fetchFeed(
  http: FetchFn,
  channelId: string,
  options: FeedOptions,
): Promise<FeedResult> {
  let lastError = '';
  for (let attempt = 1; attempt <= FEED_ATTEMPTS; attempt += 1) {
    try {
      const response = await request(
        http,
        'feed',
        feedUrl(channelId),
        { headers: { Accept: 'application/atom+xml' } },
        FEED_TIMEOUT_MS,
      );
      // A 200 is not enough on its own: an error or consent page can come
      // back as a 200 too, and parsing one would look like an empty channel.
      if (response.status === 200 && /<feed[\s>]/.test(response.text)) {
        return { ok: true, attempts: attempt, entries: parseFeed(response.text) };
      }
      lastError = response.status === 200 ? 'HTTP 200 without an Atom feed' : `HTTP ${response.status}`;
    } catch (error) {
      // Only network errors and timeouts are retried here. A spent budget or
      // a bug goes up to the run, which records it.
      if (!(error instanceof UpstreamError)) throw error;
      lastError = error.message;
    }
    options.onAttemptFailed?.(attempt, lastError);
    if (attempt < FEED_ATTEMPTS) await options.sleep(feedPause(attempt, options.random));
  }
  return {
    ok: false,
    attempts: FEED_ATTEMPTS,
    error: `the YouTube feed failed ${FEED_ATTEMPTS} times (last: ${lastError}); the next run will try again`,
  };
}

/**
 * A deliberately small parser. The feed is machine-generated and has had
 * the same shape for years, so a regular expression per field is enough,
 * and it keeps the Worker free of dependencies. An entry without a usable
 * video id or title is skipped rather than guessed at: the id ends up in
 * KV keys, URLs and the content file.
 */
export function parseFeed(xml: string): FeedEntry[] {
  const entries: FeedEntry[] = [];
  for (const match of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)) {
    const block = match[1] ?? '';
    const videoId = decodeXml(element(block, 'yt:videoId')).trim();
    const title = normaliseText(decodeXml(element(block, 'title')));
    if (!VIDEO_ID.test(videoId) || !title) continue;
    const href = alternateHref(block);
    entries.push({
      videoId,
      title,
      published: decodeXml(element(block, 'published')).trim(),
      url: href || `https://www.youtube.com/watch?v=${videoId}`,
      description: decodeXml(element(block, 'media:description')),
      format: href.includes('/shorts/') ? 'short' : 'video',
    });
  }
  return entries;
}

/** The text of the first <name>…</name> in the block, or '' when it is absent or empty. */
function element(block: string, name: string): string {
  return new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block)?.[1] ?? '';
}

function alternateHref(block: string): string {
  for (const tag of block.matchAll(/<link\b([^>]*)>/g)) {
    const attrs = attributes(tag[1] ?? '');
    if (attrs.rel === 'alternate' && attrs.href) return attrs.href;
  }
  return '';
}

function attributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attrs[match[1] ?? ''] = decodeXml(match[2] ?? match[3] ?? '');
  }
  return attrs;
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * Decode XML's five named entities and numeric references (&#39; &#x20B9;),
 * in a single pass, so "&amp;lt;" correctly becomes "&lt;" and not "<".
 * Anything unrecognised is left exactly as written.
 */
export function decodeXml(text: string): string {
  return text.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      const valid = code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
      return valid ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}
