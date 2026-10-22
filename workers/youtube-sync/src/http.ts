/**
 * The plumbing every upstream call goes through: a subrequest budget, a
 * deadline, and one error type.
 *
 * Budget. The Workers free plan allows 50 subrequests per invocation, and
 * every fetch counts: feed retries, GitHub reads and writes, OpenRouter. A
 * Worker that goes over has its 51st fetch throw wherever that happens to
 * land, possibly between classifying a video and recording the result. So
 * every fetch is counted here, and the orchestrator checks what is left
 * before it starts work it might not be able to finish. KV calls are not
 * counted: they come under a separate limit of 1,000 operations on
 * Cloudflare's own services per invocation.
 *
 * Redirects. Requests use redirect: 'manual', for two reasons. Each hop of a
 * followed redirect is another subrequest the counter would not see, and a
 * followed redirect could carry our Authorization header to a host we never
 * chose. None of these endpoints redirects in normal operation, so a 3xx is
 * handled like any other unexpected status.
 */

/** The narrow fetch every module uses, so tests can pass in a router. */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** "feed" is the RSS feed; "youtube" is the YouTube Data API. */
export type Service = 'feed' | 'youtube' | 'github' | 'openrouter';

export class UpstreamError extends Error {
  override name = 'UpstreamError';

  constructor(
    readonly service: Service,
    /** The HTTP status, or 0 when no response arrived (a network error or a timeout). */
    readonly status: number,
    message: string,
    /**
     * True when the failure is about our setup rather than this video: a
     * rejected key, credits exhausted, a missing repository or model. Such a
     * failure would repeat for every video, so the run stops rather than
     * spend each video's retry allowance on it.
     */
    readonly fatal = false,
  ) {
    super(message);
  }
}

export class BudgetExhausted extends Error {
  override name = 'BudgetExhausted';

  constructor(limit: number) {
    super(`all ${limit} subrequests for this invocation are used`);
  }
}

export class SubrequestBudget {
  used = 0;

  constructor(readonly limit: number) {}

  get remaining(): number {
    return this.limit - this.used;
  }

  /** A fetch that counts itself, and refuses rather than make request 51. */
  wrap(fetchFn: FetchFn): FetchFn {
    return (url, init) => {
      if (this.used >= this.limit) return Promise.reject(new BudgetExhausted(this.limit));
      this.used += 1;
      return fetchFn(url, init);
    };
  }
}

export interface HttpResult {
  status: number;
  headers: Headers;
  text: string;
}

/**
 * One request, start to finish, under a single deadline. The body is read
 * inside the deadline too, because a server can send its headers promptly
 * and then stall. Every response here is small (the largest, the repo tree
 * listing, is under a megabyte), so reading it whole is fine.
 */
export async function request(
  fetchFn: FetchFn,
  service: Service,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<HttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, { ...init, redirect: 'manual', signal: controller.signal });
    const text = await response.text();
    return { status: response.status, headers: response.headers, text };
  } catch (error) {
    if (error instanceof BudgetExhausted) throw error;
    if (controller.signal.aborted) {
      throw new UpstreamError(service, 0, `no response within ${timeoutMs / 1000}s`);
    }
    throw new UpstreamError(service, 0, `network error: ${describeError(error)}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Retry-After in seconds, as milliseconds; null when absent or not a number. */
export function parseRetryAfter(value: string | null): number | null {
  if (value === null || !/^\s*\d+(\.\d+)?\s*$/.test(value)) return null;
  return Math.round(Number(value) * 1000);
}

/** Scale a pause to between half and all of itself, so retries never fall into step with whatever is failing. */
export function jitter(ms: number, random: () => number): number {
  return Math.round(ms * (0.5 + random() * 0.5));
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A short, single-line description of an error, for logs and the ledger.
 *
 * A runtime's own network-error text can quote the URL it was fetching. The
 * YouTube key travels in a header, never in a URL, but as a backstop any key=
 * query parameter is blanked here, whatever produced the message. (The run
 * also redacts each secret's exact value; this catches the parameter whatever
 * its value.)
 */
export function describeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text
    .replace(/([?&]key=)[^&\s"'#]+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}
