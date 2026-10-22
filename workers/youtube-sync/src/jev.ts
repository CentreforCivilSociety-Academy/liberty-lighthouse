/**
 * Classify: one request to Jev, TypeSafe's decision model, through
 * OpenRouter's Decisions API.
 *
 * Jev does not write text. It answers typed questions about a "state"
 * object, with probabilities: here, which of the site's topics a video
 * belongs to (a "choice") and whether it is a policy explainer at all (a
 * "noul", the probability that a statement is true). This module builds
 * that request and deals with the transport. What the answers mean, and
 * whether they can be trusted, is decided in decide.ts, so nothing the
 * model returns reaches the repository without a deterministic check.
 *
 * The request carries no output-length limit. Jev's answers are a fixed
 * shape, and on reasoning models an explicit limit can be spent on hidden
 * reasoning and come back empty.
 */

import { OTHER } from './decide';
import type { FeedEntry } from './feed';
import {
  type FetchFn,
  UpstreamError,
  isRecord,
  jitter,
  parseJson,
  parseRetryAfter,
  request,
} from './http';
import type { Topic } from './repo';
import { cleanDescription, normaliseText, truncateAtWord } from './text';

export const DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';
/** At most this many requests per video per run, retries included. */
export const JEV_ATTEMPTS = 3;
export const BASIS = 'title+description';

const TIMEOUT_MS = 30_000;
/** Pauses between attempts when the server does not say how long to wait. */
const PAUSES_MS = [1_000, 3_000];
/** A Retry-After longer than this is honoured by giving up until the next run. */
const LONGEST_WAIT_MS = 20_000;
const DESCRIPTION_LIMIT = 1_200;

/**
 * Overload, rate limits and gateway timeouts pass. 402 usually means the
 * credits have run out, which retrying cannot fix, except when OpenRouter
 * says it is its own in-flight budget, which clears in seconds.
 */
const RETRY_STATUSES = new Set([429, 500, 502, 503, 524, 529]);

const TOPIC_INSTRUCTIONS =
  'Which topic page on Liberty Lighthouse, an explainer site about Indian economic and public policy, should this video be filed under?';
const OTHER_CRITERION =
  'None of the listed topics fits: the video is not mainly about any of these policy areas (for example a channel announcement, an event recording, or an unrelated subject).';
const IN_SCOPE_INSTRUCTIONS =
  'Is this video a short explainer about an Indian economic, legal or public-policy question?';
const IN_SCOPE_CRITERIA = {
  true: 'It explains a policy, law, economic idea or government decision relevant to India.',
  false: 'It is promotional, an announcement, a recording of an event, or not about Indian policy.',
};

/**
 * What the request needs to know about a video. A feed entry has all of
 * it; so does an existing content file plus a date, which is how an
 * evaluation script can replay videos editors have already filed.
 */
export type VideoInput = Pick<FeedEntry, 'title' | 'description' | 'format' | 'published'>;

export interface JevState {
  title: string;
  description: string;
  format: 'short' | 'video';
  /** YYYY-MM-DD, or '' when the input has no usable date. */
  published: string;
}

interface Question {
  type: 'choice' | 'noul';
  instructions: string;
  criteria: Record<string, string>;
}

export interface DecisionRequest {
  model: string;
  state: JevState;
  questions: { topic: Question; in_scope: Question };
}

/**
 * The Decisions API body for one video: exactly what the Worker sends, and
 * nothing that depends on the network, the clock or the environment, so an
 * evaluation script can import it and replay videos against Jev offline from
 * the Worker. Pair it with decide() from decide.ts to score the answers the
 * same way the Worker does.
 */
export function buildDecisionRequest(video: VideoInput, topics: readonly Topic[], model: string): DecisionRequest {
  return { model, state: buildState(video), questions: buildQuestions(topics) };
}

/**
 * What Jev sees: the title and a cleaned description. Transcripts would
 * help, but YouTube lets only the channel owner download captions (OAuth),
 * so the classification basis is recorded as title and description.
 */
function buildState(video: VideoInput): JevState {
  return {
    title: normaliseText(video.title),
    description: truncateAtWord(cleanDescription(video.description), DESCRIPTION_LIMIT),
    format: video.format,
    published: /^\d{4}-\d{2}-\d{2}/.exec(video.published)?.[0] ?? '',
  };
}

/** The two questions. Each topic's criterion is its own title and description from the repo. */
function buildQuestions(topics: readonly Topic[]): DecisionRequest['questions'] {
  const criteria: Record<string, string> = {};
  for (const topic of topics) {
    criteria[topic.slug] = topic.description ? `${topic.title}: ${topic.description}` : topic.title;
  }
  criteria[OTHER] = OTHER_CRITERION;
  return {
    topic: { type: 'choice', instructions: TOPIC_INSTRUCTIONS, criteria },
    in_scope: { type: 'noul', instructions: IN_SCOPE_INSTRUCTIONS, criteria: IN_SCOPE_CRITERIA },
  };
}

export type JevResult =
  | { ok: true; body: unknown; attempts: number }
  | { ok: false; error: UpstreamError; attempts: number };

export interface ClassifyOptions {
  http: FetchFn;
  apiKey: string;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  timeoutMs?: number;
  onRetry?: (attempt: number, reason: string, waitMs: number) => void;
}

type Attempt =
  | { ok: true; body: unknown }
  | { ok: false; error: UpstreamError; retryable: boolean; waitMs: number | null };

/** Send a request built by buildDecisionRequest, retrying what is worth retrying. */
export async function classify(options: ClassifyOptions, decisionRequest: DecisionRequest): Promise<JevResult> {
  const body = JSON.stringify(decisionRequest);
  for (let attempt = 1; ; attempt += 1) {
    const result = await attemptOnce(options, body);
    if (result.ok) return { ok: true, body: result.body, attempts: attempt };
    if (!result.retryable || attempt >= JEV_ATTEMPTS) return { ok: false, error: result.error, attempts: attempt };
    const waitMs = result.waitMs ?? jitter(PAUSES_MS[attempt - 1] ?? 3_000, options.random);
    // Honour the server's wait by not retrying sooner. If it is long, stop
    // here; the video stays pending and the next run asks again.
    if (waitMs > LONGEST_WAIT_MS) return { ok: false, error: result.error, attempts: attempt };
    options.onRetry?.(attempt, result.error.message, waitMs);
    await options.sleep(waitMs);
  }
}

async function attemptOnce(options: ClassifyOptions, body: string): Promise<Attempt> {
  let response;
  try {
    response = await request(
      options.http,
      'openrouter',
      DECISIONS_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://www.libertylighthouse.in',
          'X-Title': 'Liberty Lighthouse YouTube sync',
        },
        body,
      },
      options.timeoutMs ?? TIMEOUT_MS,
    );
  } catch (error) {
    // No response at all (network error or timeout): as retryable as a 5xx.
    if (error instanceof UpstreamError) return { ok: false, error, retryable: true, waitMs: null };
    throw error;
  }

  const parsed = parseJson(response.text);
  if (response.status >= 200 && response.status < 300) return { ok: true, body: parsed };

  const { status } = response;
  const inFlight = isInFlightLimit(parsed);
  // A rejected key (401), no credits (a plain 402) or an unknown model (404)
  // would fail the same way for every video, so they stop the run.
  const fatal = status === 401 || status === 404 || (status === 402 && !inFlight);
  return {
    ok: false,
    error: new UpstreamError('openrouter', status, `OpenRouter ${status}: ${messageOf(parsed, status)}`, fatal),
    retryable: RETRY_STATUSES.has(status) || (status === 402 && inFlight),
    waitMs: parseRetryAfter(response.headers.get('retry-after')),
  };
}

function isInFlightLimit(body: unknown): boolean {
  if (!isRecord(body)) return false;
  const metadata = isRecord(body.error) && isRecord(body.error.metadata) ? body.error.metadata : {};
  return (
    metadata.limit_source === 'openrouter_in_flight_budget' || body.limit_source === 'openrouter_in_flight_budget'
  );
}

/** OpenRouter's one-line error message, never the raw body or its metadata. */
function messageOf(body: unknown, status: number): string {
  const message = isRecord(body) && isRecord(body.error) ? body.error.message : undefined;
  return typeof message === 'string' ? message.replace(/\s+/g, ' ').trim().slice(0, 200) : `HTTP ${status}`;
}

export interface JevUsage {
  /** The concrete snapshot that answered, which can differ from the pinned name we sent. */
  model: string | null;
  generationId: string | null;
  inputTokens: number | null;
  cost: number | null;
}

/** Bookkeeping from a response. Read leniently: none of it affects the decision. */
export function readUsage(body: unknown): JevUsage {
  if (!isRecord(body)) return { model: null, generationId: null, inputTokens: null, cost: null };
  const usage = isRecord(body.usage) ? body.usage : {};
  const finite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null);
  return {
    model: typeof body.model === 'string' && body.model.trim() ? body.model.trim().slice(0, 100) : null,
    generationId: typeof body.id === 'string' && body.id ? body.id.slice(0, 100) : null,
    inputTokens: finite(usage.input_tokens),
    cost: finite(usage.cost),
  };
}
