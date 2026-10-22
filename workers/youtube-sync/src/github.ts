/**
 * A thin GitHub REST client: the five calls the sync needs and nothing more.
 *
 * It works with or without a token. Reading a public repository needs none,
 * which is how stage mode runs. Without a token, though, GitHub allows only
 * 60 requests an hour per IP address, and Cloudflare's outbound addresses
 * are shared with other Workers, so stage mode relies on the KV caches in
 * repo.ts to keep its reads down to one call per run that has new videos.
 *
 * Writes are create-only: the PUT never sends a `sha`, so GitHub refuses to
 * replace a file that already exists. That refusal, not the run lock, is what
 * guarantees the sync can never overwrite an editor's work or create the same
 * file twice.
 */

import { type FetchFn, type HttpResult, UpstreamError, isRecord, parseJson, request } from './http';

const API = 'https://api.github.com';
const TIMEOUT_MS = 15_000;
const USER_AGENT = 'liberty-lighthouse-youtube-sync';
const JSON_TYPE = 'application/vnd.github+json';
const RAW_TYPE = 'application/vnd.github.raw+json';

/** The identity the repository's GitHub Actions bots already commit as. */
export const BOT_COMMITTER = { name: 'liberty-lighthouse-bot', email: 'bot@liberty-lighthouse.local' } as const;

export interface TreeEntry {
  path: string;
  type: string;
  sha: string;
}

export type CreateResult =
  | { created: true; commitSha: string; url: string }
  /** GitHub answered 422; the caller reads the path to find out why. */
  | { created: false; message: string };

export interface GitHubClient {
  defaultBranch(): Promise<string>;
  /** Every path on the target branch, with the blob SHA of each file. */
  listTree(): Promise<TreeEntry[]>;
  readBlob(sha: string): Promise<string>;
  /** A file on the target branch, or null if there is none at that path. */
  readFile(path: string): Promise<string | null>;
  createFile(path: string, content: string, message: string): Promise<CreateResult>;
}

export interface GitHubOptions {
  http: FetchFn;
  repo: string;
  branch: string;
  token: string | undefined;
}

export function createGitHub({ http, repo, branch, token }: GitHubOptions): GitHubClient {
  const call = (path: string, accept: string, init: RequestInit = {}): Promise<HttpResult> => {
    const headers: Record<string, string> = {
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (init.body) headers['Content-Type'] = 'application/json';
    return request(http, 'github', `${API}/repos/${repo}${path}`, { ...init, headers }, TIMEOUT_MS);
  };
  // Branch names contain slashes (feat/...), so they are always encoded.
  const ref = encodeURIComponent(branch);

  return {
    async defaultBranch() {
      const response = await call('', JSON_TYPE);
      if (response.status !== 200) throw githubError(response);
      const data = parseJson(response.text);
      const name = isRecord(data) ? data.default_branch : undefined;
      if (typeof name !== 'string' || !name) {
        throw new UpstreamError('github', response.status, 'the repository metadata has no default_branch');
      }
      return name;
    },

    async listTree() {
      const response = await call(`/git/trees/${ref}?recursive=1`, JSON_TYPE);
      if (response.status !== 200) throw githubError(response);
      const data = parseJson(response.text);
      if (!isRecord(data) || !Array.isArray(data.tree)) {
        throw new UpstreamError('github', response.status, 'the tree listing has no tree array');
      }
      // GitHub stops at 100,000 entries or 7 MB. A truncated listing could
      // hide a video that already exists, and dedupe would then miss it, so
      // it is treated as a failure rather than a smaller repository.
      if (data.truncated === true) {
        throw new UpstreamError('github', response.status, 'the tree listing was truncated, so dedupe cannot be trusted', true);
      }
      return data.tree.filter(isTreeEntry).map(({ path, type, sha }) => ({ path, type, sha }));
    },

    async readBlob(sha) {
      const response = await call(`/git/blobs/${encodeURIComponent(sha)}`, RAW_TYPE);
      if (response.status !== 200) throw githubError(response);
      return response.text;
    },

    async readFile(path) {
      const response = await call(`/contents/${encodePath(path)}?ref=${ref}`, RAW_TYPE);
      if (response.status === 404) return null;
      if (response.status !== 200) throw githubError(response);
      return response.text;
    },

    async createFile(path, content, message) {
      const response = await call(`/contents/${encodePath(path)}`, JSON_TYPE, {
        method: 'PUT',
        // No `sha`: create, never replace. `branch` is always sent, because
        // without it GitHub writes to the default branch.
        body: JSON.stringify({ message, content: base64Utf8(content), branch, committer: BOT_COMMITTER }),
      });
      if (response.status === 201 || response.status === 200) {
        const data = parseJson(response.text);
        const commit = isRecord(data) && isRecord(data.commit) ? data.commit : {};
        return {
          created: true,
          commitSha: typeof commit.sha === 'string' ? commit.sha : '',
          url: typeof commit.html_url === 'string' ? commit.html_url : '',
        };
      }
      if (response.status === 422) return { created: false, message: messageOf(response) };
      throw githubError(response);
    },
  };
}

function isTreeEntry(value: unknown): value is TreeEntry {
  return (
    isRecord(value) &&
    typeof value.path === 'string' &&
    typeof value.type === 'string' &&
    typeof value.sha === 'string'
  );
}

/**
 * Turn a failed response into an error the run can act on. 401 (bad token),
 * 404 (no such repository or branch, or no access to it) and a 403 that is
 * not rate limiting (no permission) are fatal: they would fail the same way
 * for every video. Rate limits, conflicts and server errors are not, so
 * the video is retried on a later run.
 */
function githubError(response: HttpResult): UpstreamError {
  const message = messageOf(response);
  const rateLimited =
    response.headers.get('x-ratelimit-remaining') === '0' ||
    response.headers.has('retry-after') ||
    /rate limit/i.test(message);
  const fatal =
    response.status === 401 || response.status === 404 || (response.status === 403 && !rateLimited);
  return new UpstreamError('github', response.status, `GitHub ${response.status}: ${message}`, fatal);
}

/** GitHub's own one-line message from an error body, never the body itself. */
function messageOf(response: HttpResult): string {
  const data = parseJson(response.text);
  const message = isRecord(data) && typeof data.message === 'string' ? data.message : `HTTP ${response.status}`;
  return message.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

/** The Contents API takes Base64 of the file's bytes; btoa alone only handles Latin-1. */
export function base64Utf8(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}
