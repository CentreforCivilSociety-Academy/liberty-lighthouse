/**
 * One sync run, start to finish.
 *
 *   1. Detect    read the channel's feed, riding out its flakiness
 *   2. Filter    drop videos the ledger has already settled
 *   3. Interlock in commit mode, refuse a production branch
 *   4. Snapshot  list the branch: the videos it holds and its topics
 *   5. Dedupe    settle any new video the branch already has as "exists"
 *   6. Classify  one Jev request per video, oldest first
 *   7. Validate  decide.ts turns the answers into an outcome, or rejects them
 *   8. Persist   stage the file in the ledger, or create it on the branch
 *
 * Classification is kept separate from publication: the model decides, and
 * this code validates and applies. Of everything Jev returns, only a topic
 * slug checked against the branch's own list, and two numbers that set the
 * draft flag, reach the repository.
 *
 * Each step leaves the ledger in a state the next run can continue from, so
 * any failure (a dead feed, a GitHub outage, the subrequest budget running
 * out) costs time, never work already done or paid for. Every outside
 * dependency (fetch, KV, the clock, sleep, randomness, the log) is passed
 * in, so the tests run whole runs against fakes.
 */

import { type Config, type Mode, type Secrets, modeOf } from './config';
import { decide } from './decide';
import { type FeedEntry, fetchFeed } from './feed';
import { type GitHubClient, createGitHub } from './github';
import { BudgetExhausted, type FetchFn, SubrequestBudget, UpstreamError, describeError } from './http';
import { BASIS, JEV_ATTEMPTS, type JevResult, buildDecisionRequest, classify, readUsage } from './jev';
import {
  type Classification,
  type KvStore,
  type RunSummary,
  type Trigger,
  type VideoRecord,
  acquireLock,
  isDue,
  newRecord,
  readRecord,
  releaseLock,
  saveRunSummary,
  withFailure,
  writeRecord,
} from './ledger';
import { commitMessage, renderVideoMdx, videoPath, videoSlug } from './mdx';
import { type RepoSnapshot, extractYoutubeId, loadSnapshot } from './repo';
import { cleanDescription } from './text';

/** The Workers free plan's fetch limit per invocation. */
export const SUBREQUEST_LIMIT = 50;

/** The most fetches writing one file can take: create, read back after a 422, create at "-2", read back again. */
const PERSIST_MAX_SUBREQUESTS = 4;

export type LogLevel = 'info' | 'warn' | 'error';
export type Logger = (event: string, fields: Record<string, unknown>, level: LogLevel) => void;

export interface RunDeps {
  fetch: FetchFn;
  kv: KvStore;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  log: Logger;
}

interface Run {
  config: Config;
  deps: RunDeps;
  mode: Mode;
  summary: RunSummary;
  budget: SubrequestBudget;
  http: FetchFn;
  github: GitHubClient;
  log: (event: string, fields?: Record<string, unknown>, level?: LogLevel) => void;
  /** Record an error in the run summary (and the log). */
  fail: (message: string, level?: LogLevel) => void;
  /** An error as a short message, with any secret in it blanked out. */
  safe: (error: unknown) => string;
}

type Ask = (entry: FeedEntry) => Promise<JevResult>;

export function emptySummary(trigger: Trigger, startedAt: Date, mode: Mode): RunSummary {
  return {
    trigger,
    startedAt: startedAt.toISOString(),
    finishedAt: startedAt.toISOString(),
    mode,
    feed: { ok: false, attempts: 0, entries: 0 },
    newVideos: 0,
    classified: 0,
    committed: 0,
    staged: 0,
    needsReview: 0,
    failed: 0,
    costUsd: 0,
    subrequests: 0,
    errors: [],
  };
}

export async function runSync(
  config: Config,
  secrets: Secrets,
  deps: RunDeps,
  trigger: Trigger,
  warnings: string[] = [],
): Promise<RunSummary> {
  const startedAt = deps.now();
  const mode = modeOf(secrets);
  const summary = emptySummary(trigger, startedAt, mode);
  const budget = new SubrequestBudget(SUBREQUEST_LIMIT);
  const http = budget.wrap(deps.fetch);
  const runId = summary.startedAt;
  const log: Run['log'] = (event, fields = {}, level = 'info') => deps.log(event, { run: runId, ...fields }, level);
  const safe = (error: unknown) => redact(describeError(error), secrets);
  const run: Run = {
    config,
    deps,
    mode,
    summary,
    budget,
    http,
    github: createGitHub({ http, repo: config.githubRepo, branch: config.targetBranch, token: secrets.githubToken }),
    log,
    fail: (message, level = 'error') => {
      const clean = safe(message);
      summary.errors.push(clean);
      log('run.error', { message: clean }, level);
    },
    safe,
  };

  log('run.start', { trigger, mode, branch: config.targetBranch });
  for (const warning of warnings) run.fail(`config: ${warning}`, 'warn');

  if (!(await acquireLock(deps.kv, startedAt))) {
    summary.skipped = 'locked';
    log('run.locked', {}, 'warn');
    return summary;
  }

  try {
    await pipeline(run, secrets.openrouterApiKey);
  } catch (error) {
    run.fail(
      error instanceof BudgetExhausted
        ? `${error.message}; the next run carries on from here`
        : `run stopped: ${safe(error)}`,
    );
  } finally {
    summary.finishedAt = deps.now().toISOString();
    summary.subrequests = budget.used;
    // Rounded only to drop floating-point noise. A Jev call costs about
    // $0.000025, so anything coarser than nano-dollars would blur it.
    summary.costUsd = Math.round(summary.costUsd * 1e9) / 1e9;
    try {
      await saveRunSummary(deps.kv, summary);
    } finally {
      await releaseLock(deps.kv);
    }
    log(
      'run.done',
      {
        feed: summary.feed,
        newVideos: summary.newVideos,
        classified: summary.classified,
        committed: summary.committed,
        staged: summary.staged,
        needsReview: summary.needsReview,
        failed: summary.failed,
        costUsd: summary.costUsd,
        subrequests: summary.subrequests,
        errors: summary.errors.length,
      },
      summary.errors.length > 0 ? 'warn' : 'info',
    );
  }
  return summary;
}

async function pipeline(run: Run, apiKey: string | undefined): Promise<void> {
  const { config, deps, summary } = run;
  if (!apiKey) {
    run.fail('OPENROUTER_API_KEY is not set, so nothing can be classified');
    return;
  }

  // 1. Detect.
  const feed = await fetchFeed(run.http, config.channelId, {
    sleep: deps.sleep,
    random: deps.random,
    onAttemptFailed: (attempt, reason) => run.log('feed.retry', { attempt, reason }, 'warn'),
  });
  summary.feed = { ok: feed.ok, attempts: feed.attempts, entries: feed.ok ? feed.entries.length : 0 };
  if (!feed.ok) {
    run.fail(feed.error, 'warn');
    return;
  }
  run.log('feed.ok', { attempts: feed.attempts, entries: feed.entries.length });

  // 2. Filter. Reading the ledger first means a run with nothing new makes
  // no GitHub calls at all.
  const now = deps.now();
  const known = new Map<string, VideoRecord | null>();
  for (const entry of feed.entries) known.set(entry.videoId, await readRecord(deps.kv, entry.videoId));
  summary.newVideos = [...known.values()].filter((record) => record === null).length;
  const candidates = feed.entries
    .filter((entry) => needsWork(known.get(entry.videoId) ?? null, run.mode, now))
    .sort(oldestFirst);
  run.log('ledger.candidates', { candidates: candidates.length, newVideos: summary.newVideos });
  if (candidates.length === 0) return;

  // 3. Interlock, before anything is spent on classification.
  if (run.mode === 'commit') {
    const refusal = await interlock(run);
    if (refusal) {
      run.fail(refusal);
      return;
    }
  }

  // 4. Snapshot.
  const snapshot = await loadSnapshot(run.github, deps.kv);
  for (const warning of snapshot.warnings) run.log('repo.warning', { message: warning }, 'warn');
  run.log('repo.snapshot', {
    videos: snapshot.videos.size,
    topics: snapshot.topics.length,
    blobReads: snapshot.reads,
  });
  if (snapshot.topics.length === 0) {
    run.fail(`no usable topic files under src/content/topics on ${config.targetBranch}`);
    return;
  }

  // 5. Dedupe. It costs no subrequests, so it covers every candidate, not
  // only this run's batch.
  const todo: Array<{ entry: FeedEntry; record: VideoRecord }> = [];
  for (const entry of candidates) {
    const seen = known.get(entry.videoId) ?? null;
    const record = seen ?? newRecord(entry, now);
    const existingPath = snapshot.videos.get(entry.videoId);
    if (existingPath) {
      await save(run, settledAsExisting(record, existingPath));
      run.log('video.exists', { videoId: entry.videoId, path: existingPath });
      continue;
    }
    // Recorded as soon as it is seen, so /status shows the backlog and a
    // video left for a later batch is not counted as new again.
    todo.push({ entry, record: seen ?? (await save(run, record)) });
  }

  // 6–8. Oldest first, within the batch size, and only while the budget
  // can cover the worst case for the next video. A video never starts if
  // it might not be able to finish: the leftovers are next run's.
  const ask: Ask = (entry) =>
    classify(
      {
        http: run.http,
        apiKey,
        sleep: deps.sleep,
        random: deps.random,
        onRetry: (attempt, reason, waitMs) =>
          run.log('jev.retry', { videoId: entry.videoId, attempt, reason, waitMs }, 'warn'),
      },
      buildDecisionRequest(entry, snapshot.topics, config.jevModel),
    );
  for (const [index, { entry, record }] of todo.entries()) {
    if (index >= config.maxVideosPerRun) {
      run.log('batch.full', { left: todo.length - index });
      break;
    }
    const needed =
      (usableClassification(record, snapshot) ? 0 : JEV_ATTEMPTS) +
      (run.mode === 'commit' ? PERSIST_MAX_SUBREQUESTS : 0);
    if (run.budget.remaining < needed) {
      run.log('budget.stop', { remaining: run.budget.remaining, needed, left: todo.length - index }, 'warn');
      break;
    }
    if ((await processVideo(run, entry, record, snapshot, ask)) === 'stop') break;
  }
}

function needsWork(record: VideoRecord | null, mode: Mode, now: Date): boolean {
  if (!record) return true;
  if (record.status === 'pending') return isDue(record, now);
  // Staged is finished business in stage mode, and waiting to be written
  // once a token makes this commit mode.
  if (record.status === 'staged') return mode === 'commit';
  return false;
}

function oldestFirst(a: FeedEntry, b: FeedEntry): number {
  const byDate = (Date.parse(a.published) || 0) - (Date.parse(b.published) || 0);
  return byDate || (a.videoId < b.videoId ? -1 : a.videoId > b.videoId ? 1 : 0);
}

/**
 * The safety interlock. Writing to production must be a deliberate config
 * change, so the sync refuses "main", and whatever the repository's default
 * branch is, unless ALLOW_MAIN is "true". If the default branch cannot be
 * looked up, the error stops the run: the interlock fails closed.
 */
async function interlock(run: Run): Promise<string | null> {
  const { targetBranch, allowMain } = run.config;
  if (allowMain) return null;
  const why = 'Writing to production must be an explicit config change: set ALLOW_MAIN to "true" to allow it.';
  if (targetBranch === 'main') return `Refusing to write to "main". ${why}`;
  if ((await run.github.defaultBranch()) === targetBranch) {
    return `Refusing to write to "${targetBranch}", the repository's default branch. ${why}`;
  }
  return null;
}

/** A cached classification is reused unless its topic has left the branch since; then Jev is asked again. */
function usableClassification(record: VideoRecord, snapshot: RepoSnapshot): Classification | null {
  const cached = record.classification;
  return cached && snapshot.topicSlugs.has(cached.topic) ? cached : null;
}

async function processVideo(
  run: Run,
  entry: FeedEntry,
  initial: VideoRecord,
  snapshot: RepoSnapshot,
  ask: Ask,
): Promise<'next' | 'stop'> {
  let record = initial;
  try {
    let classification = usableClassification(record, snapshot);
    if (!classification) {
      if (record.classification) {
        run.log('video.reclassify', { videoId: entry.videoId, staleTopic: record.classification.topic }, 'warn');
      }
      const result = await classifyVideo(run, entry, record, snapshot, ask);
      if (result === 'next') return 'next';
      ({ record, classification } = result);
    }
    await persistVideo(run, entry, record, classification, snapshot);
    return 'next';
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    // A setup problem (a rejected key, no credits, no such repository) would
    // fail the same way for every video, so it stops the run without using
    // up this video's attempts.
    if (error.fatal) {
      run.fail(`${run.safe(error)}; stopping this run`);
      return 'stop';
    }
    const failed = withFailure(record, run.safe(error), run.deps.now());
    await save(run, failed);
    run.summary.failed += 1;
    run.log(
      'video.failed',
      { videoId: entry.videoId, error: failed.lastError, attempts: failed.attempts, status: failed.status },
      'warn',
    );
    return 'next';
  }
}

async function classifyVideo(
  run: Run,
  entry: FeedEntry,
  record: VideoRecord,
  snapshot: RepoSnapshot,
  ask: Ask,
): Promise<{ record: VideoRecord; classification: Classification } | 'next'> {
  const { config, deps, summary } = run;
  const result = await ask(entry);
  if (!result.ok) throw result.error;

  const usage = readUsage(result.body);
  summary.costUsd += usage.cost ?? 0;
  const now = deps.now();
  const decision = decide(result.body, {
    topicSlugs: snapshot.topics.map((topic) => topic.slug),
    autoConfidence: config.autoConfidence,
  });

  if (decision.outcome === 'invalid') {
    const failed = withFailure(record, `malformed answer from Jev: ${decision.reason}`, now, {
      status: 'needs_review',
      reason: 'malformed_response',
    });
    await save(run, failed);
    if (failed.status === 'needs_review') summary.needsReview += 1;
    else summary.failed += 1;
    run.log(
      'video.invalid',
      { videoId: entry.videoId, reason: decision.reason, attempts: failed.attempts, status: failed.status },
      'warn',
    );
    return 'next';
  }

  const classification: Classification = {
    model: usage.model ?? config.jevModel,
    topic: decision.topic,
    confidence: decision.confidence,
    probabilities: decision.probabilities,
    runnerUp: decision.runnerUp,
    inScope: decision.inScope,
    outcome: decision.outcome,
    reason: decision.reason,
    basis: BASIS,
    inputTokens: usage.inputTokens,
    cost: usage.cost,
    at: now.toISOString(),
    generationId: usage.generationId,
  };
  summary.classified += 1;
  if (decision.outcome === 'needs_review') summary.needsReview += 1;
  run.log('video.classified', {
    videoId: entry.videoId,
    model: classification.model,
    topic: decision.topic,
    confidence: decision.confidence,
    inScope: decision.inScope,
    outcome: decision.outcome,
    reason: decision.reason,
  });

  if (!decision.writeFile) {
    await save(run, {
      ...record,
      classification,
      status: 'needs_review',
      reason: 'out_of_scope',
      lastError: undefined,
      nextAttemptAt: undefined,
    });
    return 'next';
  }
  // Saved before the write is attempted: if the write fails, the next run
  // writes the file from this record without asking Jev again.
  const saved = await save(run, { ...record, classification, reason: decision.reason ?? undefined });
  return { record: saved, classification };
}

async function persistVideo(
  run: Run,
  entry: FeedEntry,
  record: VideoRecord,
  classification: Classification,
  snapshot: RepoSnapshot,
): Promise<void> {
  const { config, deps, summary } = run;
  const now = deps.now();
  const { topic } = classification;
  // The one place the draft flag is set. A file is published only when both
  // the operator (PUBLISH_MODE "auto") and the evidence (a confident
  // verdict) allow it; in every other case it waits in the CMS as a draft.
  const draft = !(config.publishMode === 'auto' && classification.outcome === 'confident');
  const mdx = renderVideoMdx(
    {
      topic,
      title: entry.title,
      youtubeId: entry.videoId,
      format: entry.format,
      description: cleanDescription(entry.description),
      draft,
    },
    {
      addedOn: now.toISOString().slice(0, 10),
      model: classification.model,
      topic,
      confidence: classification.confidence,
      runnerUp: classification.runnerUp,
      inScope: classification.inScope,
      draft,
    },
  );
  const base = videoSlug(entry.title, entry.videoId);
  // A file already at the plain slug belongs to another video with the same
  // title: if it were this video, dedupe would have settled it.
  const first = snapshot.videoPaths.has(videoPath(topic, base)) ? `${base}-2` : base;

  if (run.mode === 'stage') {
    const path = videoPath(topic, first);
    snapshot.videoPaths.add(path);
    await save(run, {
      ...record,
      status: 'staged',
      staged: { path, mdx, draft },
      lastError: undefined,
      nextAttemptAt: undefined,
    });
    summary.staged += 1;
    run.log('video.staged', { videoId: entry.videoId, path, draft });
    return;
  }

  const written = await createVideoFile(
    run,
    { entry, topic, model: classification.model, confidence: classification.confidence, mdx, base, first, draft },
    snapshot,
  );
  if (written.kind === 'exists') {
    await save(run, settledAsExisting(record, written.path));
    run.log('video.exists', { videoId: entry.videoId, path: written.path, via: 'create refused' });
    return;
  }
  await save(run, {
    ...record,
    status: 'committed',
    commit: { branch: config.targetBranch, path: written.path, sha: written.sha, url: written.url, draft },
    staged: undefined,
    lastError: undefined,
    nextAttemptAt: undefined,
  });
  summary.committed += 1;
  run.log('video.committed', { videoId: entry.videoId, path: written.path, draft, commit: written.sha });
}

interface NewFile {
  entry: FeedEntry;
  topic: string;
  model: string;
  confidence: number | null;
  mdx: string;
  base: string;
  first: string;
  draft: boolean;
}

/**
 * Create the file, create-only. A 422 means something already sits at the
 * path. If it is this video (an overlapping run, or an editor, got there
 * between our tree listing and now), that is success. If it is a different
 * video with the same title, this one moves to "-2", once; a second clash
 * needs a person to choose a filename.
 */
async function createVideoFile(
  run: Run,
  file: NewFile,
  snapshot: RepoSnapshot,
): Promise<{ kind: 'created'; path: string; sha: string; url: string } | { kind: 'exists'; path: string }> {
  const { entry, topic } = file;
  for (let slug = file.first; ; slug = `${file.base}-2`) {
    const path = videoPath(topic, slug);
    const message = commitMessage({
      topic,
      slug,
      url: entry.url,
      model: file.model,
      confidence: file.confidence,
      draft: file.draft,
    });
    const result = await run.github.createFile(path, file.mdx, message);
    if (result.created) {
      snapshot.videoPaths.add(path);
      snapshot.videos.set(entry.videoId, path);
      return { kind: 'created', path, sha: result.commitSha, url: result.url };
    }
    const existing = await run.github.readFile(path);
    if (existing === null) throw new UpstreamError('github', 422, `GitHub refused to create ${path}: ${result.message}`);
    if (extractYoutubeId(existing) === entry.videoId) return { kind: 'exists', path };
    snapshot.videoPaths.add(path);
    if (slug !== file.base) {
      throw new UpstreamError(
        'github',
        422,
        `${videoPath(topic, file.base)} and ${path} both hold other videos; this one needs a filename chosen by hand`,
      );
    }
  }
}

function settledAsExisting(record: VideoRecord, path: string): VideoRecord {
  return {
    ...record,
    status: 'exists',
    reason: 'already_in_repo',
    existingPath: path,
    staged: undefined,
    lastError: undefined,
    nextAttemptAt: undefined,
  };
}

function save(run: Run, record: VideoRecord): Promise<VideoRecord> {
  return writeRecord(run.deps.kv, record, run.deps.now());
}

/**
 * Upstream error messages are short, but they are not ours. Never let one
 * carry a secret into a log line or the ledger.
 */
function redact(text: string, secrets: Secrets): string {
  let clean = text;
  for (const secret of [secrets.openrouterApiKey, secrets.githubToken, secrets.adminToken]) {
    if (secret && secret.length >= 8) clean = clean.split(secret).join('[redacted]');
  }
  return clean;
}
