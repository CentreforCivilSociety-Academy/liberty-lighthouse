/**
 * The Worker's two entry points.
 *
 * scheduled: the cron trigger (every six hours) runs the sync.
 *
 * fetch: a deliberately small admin surface on the workers.dev URL. Without
 * an ADMIN_TOKEN secret it does not exist: every request gets a 404, so the
 * URL does not even reveal that anything is listening. With the secret set,
 * a request carrying it as a Bearer token can read the ledger (GET /status)
 * or start a run now (POST /run). A wrong or missing token gets the same 404
 * as an unknown path.
 */

import { ConfigError, detectionOf, modeOf, publicConfig, readConfig, readSecrets } from './config';
import {
  type RunSummary,
  STATUSES,
  type StagedInfo,
  type Trigger,
  type VideoRecord,
  type VideoStatus,
  listRecords,
  readLastRun,
  saveRunSummary,
} from './ledger';
import { type Logger, emptySummary, runSync } from './run';

export default {
  async fetch(request, env): Promise<Response> {
    const adminToken = readSecrets(env).adminToken;
    if (!adminToken || !(await bearerMatches(request, adminToken))) return notFound();

    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/status') {
        return Response.json(await statusReport(env, url.searchParams.get('full') === '1'));
      }
      if (request.method === 'POST' && url.pathname === '/run') {
        const summary = await runFromEnv(env, 'manual');
        return Response.json(summary, { status: summary.skipped ? 409 : 200 });
      }
      return notFound();
    } catch (error) {
      // The name only: a message could quote an upstream response.
      console.error(JSON.stringify({ level: 'error', event: 'http.error', path: url.pathname, error: errorName(error) }));
      return Response.json({ error: 'internal error' }, { status: 500 });
    }
  },

  async scheduled(_controller, env): Promise<void> {
    await runFromEnv(env, 'cron');
  },
} satisfies ExportedHandler<Env>;

async function runFromEnv(env: Env, trigger: Trigger): Promise<RunSummary> {
  const secrets = readSecrets(env);
  let parsed: ReturnType<typeof readConfig>;
  try {
    parsed = readConfig(env);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    // Saved like any other run, so /status shows why nothing happened.
    const summary = {
      ...emptySummary(trigger, new Date(), modeOf(secrets), detectionOf(secrets)),
      errors: [`config: ${error.message}`],
    };
    await saveRunSummary(env.LEDGER, summary);
    log('run.error', { message: summary.errors[0] }, 'error');
    return summary;
  }
  return runSync(
    parsed.config,
    secrets,
    {
      fetch: (input, init) => fetch(input, init),
      kv: env.LEDGER,
      now: () => new Date(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      // Jitter for retry pauses only; nothing security-sensitive is random here.
      random: Math.random,
      log,
    },
    trigger,
    parsed.warnings,
  );
}

/** One JSON object per line, so Workers Logs can filter on any field. */
const log: Logger = (event, fields, level) => {
  const line = JSON.stringify({ level, event, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

async function statusReport(env: Env, full: boolean): Promise<Record<string, unknown>> {
  let config: Record<string, unknown>;
  try {
    config = publicConfig(readConfig(env).config, readSecrets(env));
  } catch (error) {
    config = { error: error instanceof ConfigError ? error.message : 'the configuration could not be read' };
  }
  const records = await listRecords(env.LEDGER);
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<VideoStatus, number>;
  for (const record of records) counts[record.status] = (counts[record.status] ?? 0) + 1;
  records.sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : 0));
  return {
    config,
    lastRun: await readLastRun(env.LEDGER),
    counts,
    videos: full ? records : records.map(withoutStagedBody),
  };
}

/** Staged files are a few kilobytes each; /status lists their paths unless ?full=1 asks for the text. */
function withoutStagedBody(
  record: VideoRecord,
): Omit<VideoRecord, 'staged'> & { staged?: Omit<StagedInfo, 'mdx'> } {
  if (!record.staged) return record;
  const { mdx: _omitted, ...staged } = record.staged;
  return { ...record, staged };
}

/**
 * Compare the presented token with ADMIN_TOKEN in constant time. Both are
 * hashed first: timingSafeEqual needs equal-length buffers (it throws
 * otherwise), and comparing two 32-byte digests takes the same time however
 * long the guess is, so the comparison leaks neither the token nor its
 * length. Any mismatch, including a wrong length, is a 404.
 */
async function bearerMatches(request: Request, expected: string): Promise<boolean> {
  const presented = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!presented) return false;
  const encoder = new TextEncoder();
  const [given, wanted] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(presented)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(given, wanted);
}

function notFound(): Response {
  return new Response('Not found', { status: 404 });
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}
