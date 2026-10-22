/**
 * Detect, through the YouTube Data API v3: the dependable path, used when a
 * YOUTUBE_API_KEY secret is set.
 *
 * The public RSS feed (feed.ts) needs no key, but it has stopped being
 * dependable. In live runs from both `wrangler dev` and the deployed Worker it
 * failed 20 times in 20 and 8 in 8 for this channel, where earlier the same
 * day it had answered one request in three to twelve. The Data API answers the
 * same question for two quota units a run, and this module returns the same
 * FeedEntry[] the feed parser does, so every later step is unchanged.
 *
 *   1. playlistItems.list on the channel's uploads playlist, whose id is the
 *      channel id with its "UC" prefix changed to "UU". It returns the 15
 *      latest uploads, the same window as the feed. Only public items are
 *      kept: private and deleted uploads stay in the playlist as "Private
 *      video" and "Deleted video" placeholders, and unlisted ones are not
 *      for the site either.
 *   2. videos.list for those ids, to learn each video's duration and the
 *      shape of its embedded player. A Short is vertical (the player is
 *      taller than it is wide) and at most three minutes long. If this call
 *      fails, the format falls back to the "#shorts" hashtag, which is weaker,
 *      and the log says so.
 *
 * If the first call cannot be made to work (a bad key, the day's quota
 * spent, the API not enabled for the key's project), the caller logs the
 * reason and reads the RSS feed instead, in the same run.
 *
 * The key travels in the x-goog-api-key header, as Google's API-key
 * documentation advises: the alternative, a key= query parameter, puts the key
 * in the URL, where request traces and URL scans can see it. No message built here includes a URL or a runtime's error text
 * either, and describeError (http.ts) still blanks any key= parameter that
 * might slip through from elsewhere.
 */

import type { FeedEntry } from './feed';
import { type FetchFn, UpstreamError, isRecord, jitter, parseJson, request } from './http';
import { normaliseText } from './text';

const API = 'https://www.googleapis.com/youtube/v3';
const TIMEOUT_MS = 10_000;
/** Each call is tried at most twice: a 5xx or a timeout gets one quick retry. */
export const API_ATTEMPTS = 2;
const RETRY_PAUSE_MS = 500;
/** The same window as the RSS feed. */
const MAX_RESULTS = 15;
/** YouTube allows Shorts of up to three minutes. */
const SHORT_MAX_SECONDS = 180;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export type UploadsResult =
  | { ok: true; entries: FeedEntry[]; requests: number }
  | { ok: false; reason: string; requests: number };

export interface UploadsOptions {
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  log: (event: string, fields: Record<string, unknown>, level: 'info' | 'warn') => void;
  timeoutMs?: number;
}

/** "UCF5Yih_…" → "UUF5Yih_…", or null for an id that is not a channel id. */
export function uploadsPlaylistId(channelId: string): string | null {
  return /^UC[A-Za-z0-9_-]{22}$/.test(channelId) ? `UU${channelId.slice(2)}` : null;
}

export async function fetchUploads(
  http: FetchFn,
  channelId: string,
  apiKey: string,
  options: UploadsOptions,
): Promise<UploadsResult> {
  const playlistId = uploadsPlaylistId(channelId);
  if (!playlistId) {
    return { ok: false, reason: 'CHANNEL_ID is not a "UC…" channel id, so its uploads playlist is unknown', requests: 0 };
  }

  const playlist = await callApi(http, apiKey, options, 'playlistItems', {
    part: 'snippet,contentDetails,status',
    maxResults: String(MAX_RESULTS),
    playlistId,
  });
  if (!playlist.ok) return { ok: false, reason: playlist.reason, requests: playlist.requests };
  const uploads = publicUploads(playlist.body);
  if (!uploads) {
    return { ok: false, reason: 'playlistItems.list answered without an items array', requests: playlist.requests };
  }
  if (uploads.length === 0) return { ok: true, entries: [], requests: playlist.requests };

  const videos = await callApi(http, apiKey, options, 'videos', {
    part: 'contentDetails,player',
    maxWidth: '1000',
    id: uploads.map((upload) => upload.videoId).join(','),
  });
  const details = videos.ok ? videoDetails(videos.body) : null;
  const missing = details ? uploads.filter((upload) => !details.has(upload.videoId)).length : uploads.length;
  if (missing > 0) {
    options.log(
      'youtube.format_fallback',
      {
        reason: !videos.ok ? videos.reason : details ? 'videos.list did not describe every video' : 'videos.list answered without an items array',
        videos: missing,
        rule: 'Short only when the title or description has #shorts',
      },
      'warn',
    );
  }

  const entries = uploads.map((upload): FeedEntry => {
    const detail = details?.get(upload.videoId);
    const format = detail ? formatFromPlayer(detail) : formatFromHashtag(upload);
    return {
      ...upload,
      format,
      url:
        format === 'short'
          ? `https://www.youtube.com/shorts/${upload.videoId}`
          : `https://www.youtube.com/watch?v=${upload.videoId}`,
    };
  });
  return { ok: true, entries, requests: playlist.requests + videos.requests };
}

type ApiCall = { ok: true; body: unknown; requests: number } | { ok: false; reason: string; requests: number };

/**
 * One API call, with a single quick retry for a 5xx, a timeout or a network
 * error. Anything else (400, 403, 404...) will not get better within the run,
 * so it is returned at once. The reason names the call and Google's own
 * reason code (quotaExceeded, keyInvalid...), never the URL or Google's
 * message text.
 */
async function callApi(
  http: FetchFn,
  apiKey: string,
  options: UploadsOptions,
  resource: 'playlistItems' | 'videos',
  params: Record<string, string>,
): Promise<ApiCall> {
  const url = `${API}/${resource}?${new URLSearchParams(params)}`;
  let reason = '';
  for (let attempt = 1; attempt <= API_ATTEMPTS; attempt += 1) {
    let retryable: boolean;
    try {
      const response = await request(
        http,
        'youtube',
        url,
        { headers: { Accept: 'application/json', 'X-Goog-Api-Key': apiKey } },
        options.timeoutMs ?? TIMEOUT_MS,
      );
      if (response.status === 200) return { ok: true, body: parseJson(response.text), requests: attempt };
      reason = `${resource}.list ${response.status}: ${googleReason(parseJson(response.text))}`;
      retryable = response.status >= 500;
    } catch (error) {
      if (!(error instanceof UpstreamError)) throw error;
      // Only our own wording: a runtime's network-error text could quote the URL.
      reason = `${resource}.list: ${error.message.startsWith('no response') ? error.message : 'network error'}`;
      retryable = true;
    }
    if (!retryable || attempt === API_ATTEMPTS) return { ok: false, reason, requests: attempt };
    options.log('youtube.retry', { call: `${resource}.list`, attempt, reason }, 'warn');
    await options.sleep(jitter(RETRY_PAUSE_MS, options.random));
  }
  return { ok: false, reason, requests: API_ATTEMPTS };
}

/**
 * Google's machine-readable reason from an error body: error.errors[0].reason
 * (quotaExceeded, keyInvalid, accessNotConfigured...), plus the newer
 * error.details[0].reason when it adds something (an invalid key now comes back
 * as "badRequest" with "API_KEY_INVALID" in details). Only plain identifiers
 * are kept, so nothing from the body can carry a URL into the log.
 */
function googleReason(body: unknown): string {
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const reasonAt = (list: unknown): string | null => {
    const first: unknown = Array.isArray(list) ? list[0] : undefined;
    const reason = isRecord(first) ? first.reason : undefined;
    return typeof reason === 'string' && /^[A-Za-z0-9_.]{1,64}$/.test(reason) ? reason : null;
  };
  const primary = reasonAt(error.errors);
  const detail = reasonAt(error.details);
  if (primary && detail && primary !== detail) return `${primary} (${detail})`;
  return primary ?? detail ?? 'no reason given';
}

type Upload = Omit<FeedEntry, 'format' | 'url'>;

/**
 * The public uploads in a playlistItems.list response, newest first, or null
 * if the response has no items array. An item is used only if it is public
 * and has a valid video id and a title.
 */
export function publicUploads(body: unknown): Upload[] | null {
  if (!isRecord(body) || !Array.isArray(body.items)) return null;
  const uploads: Upload[] = [];
  for (const item of body.items) {
    if (!isRecord(item) || !isRecord(item.status) || item.status.privacyStatus !== 'public') continue;
    const snippet = isRecord(item.snippet) ? item.snippet : {};
    const details = isRecord(item.contentDetails) ? item.contentDetails : {};
    const videoId = typeof details.videoId === 'string' ? details.videoId : '';
    const title = typeof snippet.title === 'string' ? normaliseText(snippet.title) : '';
    if (!VIDEO_ID.test(videoId) || !title) continue;
    // videoPublishedAt is when the video went public; snippet.publishedAt is
    // when it joined the playlist, which for uploads is nearly the same.
    const published =
      typeof details.videoPublishedAt === 'string'
        ? details.videoPublishedAt
        : typeof snippet.publishedAt === 'string'
          ? snippet.publishedAt
          : '';
    uploads.push({
      videoId,
      title,
      published,
      description: typeof snippet.description === 'string' ? snippet.description : '',
    });
  }
  return uploads;
}

interface VideoDetail {
  duration: unknown;
  embedWidth: unknown;
  embedHeight: unknown;
}

/** Duration and player size by video id, or null if the response has no items array. */
function videoDetails(body: unknown): Map<string, VideoDetail> | null {
  if (!isRecord(body) || !Array.isArray(body.items)) return null;
  const details = new Map<string, VideoDetail>();
  for (const item of body.items) {
    if (!isRecord(item) || typeof item.id !== 'string') continue;
    const contentDetails = isRecord(item.contentDetails) ? item.contentDetails : {};
    const player = isRecord(item.player) ? item.player : {};
    details.set(item.id, {
      duration: contentDetails.duration,
      embedWidth: player.embedWidth,
      embedHeight: player.embedHeight,
    });
  }
  return details;
}

/**
 * A Short is vertical and at most three minutes long. The player's size is
 * the API's own answer to "vertical?": it is only reported when the request
 * sets maxWidth and YouTube knows the aspect ratio, and the API sends these
 * 64-bit numbers as strings. Anything missing or unreadable means "video",
 * the format that never claims too much.
 */
export function formatFromPlayer(detail: VideoDetail): 'short' | 'video' {
  const width = Number(detail.embedWidth);
  const height = Number(detail.embedHeight);
  const vertical = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > width;
  const seconds = typeof detail.duration === 'string' ? parseIsoDuration(detail.duration) : null;
  // A zero duration ("P0D") is a live or upcoming stream, not a Short.
  return vertical && seconds !== null && seconds > 0 && seconds <= SHORT_MAX_SECONDS ? 'short' : 'video';
}

/** The weaker rule, for when videos.list could not be read. */
export function formatFromHashtag(upload: Pick<FeedEntry, 'title' | 'description'>): 'short' | 'video' {
  return /#shorts\b/i.test(`${upload.title} ${upload.description}`) ? 'short' : 'video';
}

/** Seconds in an ISO 8601 duration as YouTube writes them (PT15M33S, PT1H2M3S, P1DT2H), or null. */
export function parseIsoDuration(text: string): number | null {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(text);
  if (!match || text === 'P' || text.endsWith('T')) return null;
  const [, days, hours, minutes, seconds] = match;
  return Number(days ?? 0) * 86_400 + Number(hours ?? 0) * 3_600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
}
