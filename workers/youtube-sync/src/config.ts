/**
 * Settings, read fresh from the Worker's environment on every invocation.
 *
 * Non-secret settings are `vars` in wrangler.jsonc, so changing one is a
 * reviewed config change rather than a dashboard click. Secrets come from
 * `wrangler secret put` and only ever travel inside request headers: they
 * are never logged, stored in the ledger or returned by /status.
 *
 * A bad value in an optional setting falls back to its default instead of
 * stopping the Worker, because every default is the cautious choice: drafts,
 * a high bar for confidence, a small batch. The fallback is reported in the
 * run log. A bad value in a setting that says *where* to read or write stops
 * the run, because guessing a repository or a branch is never safe.
 */

export const VAR_NAMES = [
  'CHANNEL_ID',
  'GITHUB_REPO',
  'TARGET_BRANCH',
  'PUBLISH_MODE',
  'JEV_MODEL',
  'AUTO_CONFIDENCE',
  'MAX_VIDEOS_PER_RUN',
  'ALLOW_MAIN',
] as const;

export type EnvVars = Partial<Record<(typeof VAR_NAMES)[number], string>>;

/** "review" writes every file as a draft; "auto" publishes confident ones. */
export type PublishMode = 'review' | 'auto';

/** "stage" keeps would-be files in the ledger; "commit" writes them to GitHub. */
export type Mode = 'stage' | 'commit';

/** Where new uploads are detected: the YouTube Data API, or the public RSS feed. */
export type DetectionSource = 'api' | 'rss';

export interface Config {
  channelId: string;
  githubRepo: string;
  targetBranch: string;
  publishMode: PublishMode;
  jevModel: string;
  autoConfidence: number;
  maxVideosPerRun: number;
  allowMain: boolean;
}

export interface Secrets {
  openrouterApiKey: string | undefined;
  githubToken: string | undefined;
  adminToken: string | undefined;
  youtubeApiKey: string | undefined;
}

export const DEFAULTS = {
  publishMode: 'review',
  // Pinned on purpose. Jev's probabilities shift between versions, and
  // AUTO_CONFIDENCE was chosen against this one, so moving to a new version
  // is a decision to re-check the threshold, not a silent upgrade.
  jevModel: 'typesafe/jev-1.14',
  // Calibrated on jev-1.14-20261014: topic answers between 0.8 and 0.9 were
  // right only 76% of the time (21 of them), against 98–100% at 0.9 and up.
  // On 145 FAQ texts standing in for videos, raising the bar from 0.8 lifts
  // the precision of "confident" from 93.6% to 98.7% (78 of 79); on the
  // channel's real videos it stays at 100% (18 of 18, against 21 of 21), so
  // the cost is three more drafts, not a wrong page.
  autoConfidence: 0.9,
  maxVideosPerRun: 4,
} as const;

export class ConfigError extends Error {
  override name = 'ConfigError';
}

export function readConfig(env: EnvVars): { config: Config; warnings: string[] } {
  const warnings: string[] = [];

  const config: Config = {
    channelId: required(env.CHANNEL_ID, 'CHANNEL_ID', /^[A-Za-z0-9_-]+$/),
    githubRepo: required(env.GITHUB_REPO, 'GITHUB_REPO', /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
    // A conservative subset of git's branch-name rules. It matters because an
    // empty or odd branch would not fail safely: GitHub writes to the
    // repository's default branch when a request names none.
    targetBranch: required(
      env.TARGET_BRANCH,
      'TARGET_BRANCH',
      /^(?!\/)(?!.*\/$)(?!.*\.\.)[A-Za-z0-9._/-]+$/,
    ),
    publishMode: DEFAULTS.publishMode,
    jevModel: env.JEV_MODEL?.trim() || DEFAULTS.jevModel,
    autoConfidence: DEFAULTS.autoConfidence,
    maxVideosPerRun: DEFAULTS.maxVideosPerRun,
    allowMain: env.ALLOW_MAIN?.trim() === 'true',
  };

  const publishMode = env.PUBLISH_MODE?.trim();
  if (publishMode === 'review' || publishMode === 'auto') {
    config.publishMode = publishMode;
  } else if (publishMode) {
    warnings.push(`PUBLISH_MODE "${publishMode}" is not "review" or "auto"; using "review"`);
  }

  const autoConfidence = env.AUTO_CONFIDENCE?.trim();
  if (autoConfidence) {
    const value = Number(autoConfidence);
    if (Number.isFinite(value) && value >= 0 && value <= 1) {
      config.autoConfidence = value;
    } else {
      warnings.push(
        `AUTO_CONFIDENCE "${autoConfidence}" is not a number between 0 and 1; using ${DEFAULTS.autoConfidence}`,
      );
    }
  }

  const maxVideos = env.MAX_VIDEOS_PER_RUN?.trim();
  if (maxVideos) {
    const value = Number(maxVideos);
    if (Number.isInteger(value) && value >= 1) {
      config.maxVideosPerRun = value;
    } else {
      warnings.push(
        `MAX_VIDEOS_PER_RUN "${maxVideos}" is not a whole number of at least 1; using ${DEFAULTS.maxVideosPerRun}`,
      );
    }
  }

  return { config, warnings };
}

function required(value: string | undefined, name: string, pattern: RegExp): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) throw new ConfigError(`${name} is not set`);
  if (!pattern.test(trimmed)) throw new ConfigError(`${name} "${trimmed}" is not valid`);
  return trimmed;
}

/**
 * The four secrets, each of which may be absent:
 *
 *   OPENROUTER_API_KEY  needed to classify; without it a run stops at once
 *   GITHUB_TOKEN        absent means stage mode: nothing is written to GitHub
 *   ADMIN_TOKEN         absent means no HTTP surface: every request is a 404
 *   YOUTUBE_API_KEY     absent means new uploads are found through the RSS feed
 *
 * They are read by name and checked here, rather than trusted from the Env
 * type. `wrangler types` lists them as plain strings (it learns the names
 * from .dev.vars.example), but at runtime an unset secret is simply missing,
 * and three of these are meant to be unset in some deployments. An empty value
 * also counts as unset, so a copy of .dev.vars.example means "not configured".
 */
export function readSecrets(env: object): Secrets {
  const read = (name: string): string | undefined => {
    const value: unknown = Reflect.get(env, name);
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };
  return {
    openrouterApiKey: read('OPENROUTER_API_KEY'),
    githubToken: read('GITHUB_TOKEN'),
    adminToken: read('ADMIN_TOKEN'),
    youtubeApiKey: read('YOUTUBE_API_KEY'),
  };
}

export function modeOf(secrets: Secrets): Mode {
  return secrets.githubToken ? 'commit' : 'stage';
}

/** The detection path a run starts with; it falls back to RSS if the API is unusable that run. */
export function detectionOf(secrets: Secrets): DetectionSource {
  return secrets.youtubeApiKey ? 'api' : 'rss';
}

/** The settings /status may show: vars, the mode and the detection path. Never a secret's value. */
export function publicConfig(config: Config, secrets: Secrets): Record<string, unknown> {
  return { ...config, mode: modeOf(secrets), detection: detectionOf(secrets) };
}
