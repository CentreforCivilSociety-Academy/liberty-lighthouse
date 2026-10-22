/**
 * The ledger: what the sync knows, kept in the LEDGER KV namespace.
 *
 *   video:<youtubeId>  one record per video: where it is in the pipeline,
 *                      why, what Jev said, and what was written
 *   run:last           the summary of the most recent run
 *   run:history        the last 20 run summaries, newest first
 *   cache:*            what repo.ts learned from blobs, keyed by blob SHA
 *   lock:run           present while a run is in progress
 *
 * A video's status is one of:
 *
 *   pending       work remains: it is new, or waiting to retry a failure
 *   staged        stage mode: the would-be file is kept here, not written
 *   committed     the file was created on the branch
 *   exists        the branch already had the video (an editor added it,
 *                 or an overlapping run got there first)
 *   needs_review  Jev placed it out of scope, or kept giving malformed
 *                 answers. No file is written; a person decides.
 *   failed        five attempts failed; a person has to look
 *
 * "staged" is picked up again once a GITHUB_TOKEN is set, so moving from
 * stage mode to commit mode writes what was staged. Every status other
 * than "pending" and "staged" is settled, and the sync never touches it
 * again. To make it try a video afresh, delete the video's key (see
 * README.md).
 */

import type { DetectionSource, Mode } from './config';
import type { ReviewReason, RunnerUp } from './decide';
import type { FeedEntry } from './feed';

export type VideoStatus = 'pending' | 'staged' | 'committed' | 'exists' | 'needs_review' | 'failed';

export const STATUSES: readonly VideoStatus[] = [
  'pending',
  'staged',
  'committed',
  'exists',
  'needs_review',
  'failed',
];

/** Failed attempts before a video stops being retried. */
export const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 60 * 60 * 1000;
const RETRY_MAX_MS = 24 * 60 * 60 * 1000;

/**
 * What Jev said, and what decide.ts made of it. It is cached on the record
 * as soon as it exists, so a failed write is retried without asking (and
 * paying) Jev a second time.
 */
export interface Classification {
  /** The concrete snapshot that answered, e.g. typesafe/jev-1.14-20261014. */
  model: string;
  topic: string;
  confidence: number | null;
  probabilities: Record<string, number> | null;
  runnerUp: RunnerUp | null;
  inScope: number;
  outcome: 'confident' | 'needs_review';
  reason: ReviewReason | null;
  /** What Jev was shown. Transcripts need the channel owner's OAuth, so never. */
  basis: 'title+description';
  inputTokens: number | null;
  cost: number | null;
  at: string;
  generationId: string | null;
}

export interface CommitInfo {
  branch: string;
  path: string;
  sha: string;
  url: string;
  draft: boolean;
}

export interface StagedInfo {
  path: string;
  mdx: string;
  draft: boolean;
}

export interface VideoRecord {
  videoId: string;
  title: string;
  published: string;
  url: string;
  format: 'short' | 'video';
  status: VideoStatus;
  reason?: string;
  /** Failed attempts so far. */
  attempts: number;
  lastError?: string;
  nextAttemptAt?: string;
  classification?: Classification;
  commit?: CommitInfo;
  staged?: StagedInfo;
  /** For "exists": the file that already holds the video. */
  existingPath?: string;
  firstSeenAt: string;
  updatedAt: string;
}

export type Trigger = 'cron' | 'manual';

export interface RunSummary {
  trigger: Trigger;
  startedAt: string;
  finishedAt: string;
  mode: Mode;
  /**
   * Detection. `source` is where the uploads were read from: "api" (the
   * YouTube Data API) or "rss" (the public feed, used without a key or when
   * the API was unusable this run). `attempts` counts requests to that source.
   */
  feed: { ok: boolean; source: DetectionSource; attempts: number; entries: number };
  /** Feed entries the ledger had never seen before this run. */
  newVideos: number;
  /** Videos whose answers from Jev passed validation. */
  classified: number;
  committed: number;
  staged: number;
  /** Videos that need a person: out of scope, an uncertain topic, or repeated malformed answers. */
  needsReview: number;
  /** Videos whose attempt failed this run. They are retried later, up to five attempts in all. */
  failed: number;
  /** As reported by OpenRouter for this run's requests. */
  costUsd: number;
  subrequests: number;
  errors: string[];
  /** Set when another run held the lock, so this one did nothing. */
  skipped?: 'locked';
}

/**
 * The part of the KV binding the sync uses. A narrow interface rather than
 * KVNamespace itself, so the tests can pass a small in-memory fake.
 */
export interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

/**
 * Everything in this namespace is written by this Worker, so values are
 * trusted to have the shape we wrote. A value that does not parse is
 * treated as absent; for a video that only means it is looked at again, and
 * the create-only write still prevents a duplicate file.
 */
export async function readJson<T>(kv: KvStore, key: string): Promise<T | null> {
  const text = await kv.get(key);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function writeJson(kv: KvStore, key: string, value: unknown, expirationTtl?: number): Promise<void> {
  await kv.put(key, JSON.stringify(value), expirationTtl ? { expirationTtl } : undefined);
}

export function videoKey(videoId: string): string {
  return `video:${videoId}`;
}

export function readRecord(kv: KvStore, videoId: string): Promise<VideoRecord | null> {
  return readJson<VideoRecord>(kv, videoKey(videoId));
}

export async function writeRecord(kv: KvStore, record: VideoRecord, now: Date): Promise<VideoRecord> {
  const saved = { ...record, updatedAt: now.toISOString() };
  await writeJson(kv, videoKey(record.videoId), saved);
  return saved;
}

export function newRecord(entry: FeedEntry, now: Date): VideoRecord {
  return {
    videoId: entry.videoId,
    title: entry.title,
    published: entry.published,
    url: entry.url,
    format: entry.format,
    status: 'pending',
    attempts: 0,
    firstSeenAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/**
 * Record one failed attempt. Below MAX_ATTEMPTS the video stays pending and
 * waits 1, 2, 4, then 8 hours before its next try. With a six-hourly cron
 * that spreads five attempts over about a day and a half, which rides out
 * an outage without hammering anyone. At MAX_ATTEMPTS it settles as
 * `giveUp` (failed, unless the caller says otherwise) and waits for a person.
 */
export function withFailure(
  record: VideoRecord,
  message: string,
  now: Date,
  giveUp: { status: 'failed' | 'needs_review'; reason?: string } = { status: 'failed' },
): VideoRecord {
  const attempts = record.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    return {
      ...record,
      attempts,
      status: giveUp.status,
      reason: giveUp.reason ?? record.reason,
      lastError: message,
      nextAttemptAt: undefined,
    };
  }
  const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (attempts - 1));
  return {
    ...record,
    attempts,
    status: 'pending',
    lastError: message,
    nextAttemptAt: new Date(now.getTime() + delay).toISOString(),
  };
}

export function isDue(record: VideoRecord, now: Date): boolean {
  return !record.nextAttemptAt || Date.parse(record.nextAttemptAt) <= now.getTime();
}

/** Every video record, for /status. One list call per 1,000 keys, then one read per record. */
export async function listRecords(kv: KvStore): Promise<VideoRecord[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: 'video:', cursor });
    names.push(...page.keys.map((key) => key.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const records = await Promise.all(names.map((name) => readJson<VideoRecord>(kv, name)));
  return records.filter((record): record is VideoRecord => record !== null);
}

const LAST_RUN_KEY = 'run:last';
const HISTORY_KEY = 'run:history';
const HISTORY_LENGTH = 20;

export function readLastRun(kv: KvStore): Promise<RunSummary | null> {
  return readJson<RunSummary>(kv, LAST_RUN_KEY);
}

export async function saveRunSummary(kv: KvStore, summary: RunSummary): Promise<void> {
  const history = (await readJson<RunSummary[]>(kv, HISTORY_KEY)) ?? [];
  await writeJson(kv, HISTORY_KEY, [summary, ...history].slice(0, HISTORY_LENGTH));
  await writeJson(kv, LAST_RUN_KEY, summary);
}

const LOCK_KEY = 'lock:run';
const LOCK_TTL_SECONDS = 600;

/**
 * A best-effort guard against a cron run and a manual run overlapping.
 *
 * KV is eventually consistent: a write can take up to a minute to be seen
 * from another Cloudflare location, so two runs that start close together
 * can both find no lock and both carry on. That is acceptable, because the
 * lock is not what prevents duplicates. The create-only PUT is: GitHub
 * refuses to create a file that already exists, and the sync treats that as
 * success when the file holds the same video. The lock just saves wasted
 * work and a second Jev charge in the common case. The ten-minute TTL is well
 * past the longest possible run, and frees the lock if a run dies holding it.
 */
export async function acquireLock(kv: KvStore, now: Date): Promise<boolean> {
  if ((await kv.get(LOCK_KEY)) !== null) return false;
  await kv.put(LOCK_KEY, now.toISOString(), { expirationTtl: LOCK_TTL_SECONDS });
  return true;
}

export async function releaseLock(kv: KvStore): Promise<void> {
  await kv.delete(LOCK_KEY);
}
