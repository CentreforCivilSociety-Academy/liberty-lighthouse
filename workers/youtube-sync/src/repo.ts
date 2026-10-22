/**
 * What the target branch already holds: its videos, for dedupe, and its
 * topics, the taxonomy Jev must choose from.
 *
 * Both come from the repository rather than from this Worker's config,
 * because the repository is what the site is built from. A topic added in
 * the CMS becomes a choice for the next video without a redeploy, and a
 * video an editor added by hand is never added a second time.
 *
 * One recursive tree listing gives every path on the branch with its blob
 * SHA. A blob SHA names exact file contents, so whatever we learn from a
 * blob (the youtubeId in a video file, the fields of a topic file) can be
 * cached in KV under that SHA and never read again. In the steady state
 * this costs one GitHub call per run; the first run reads each video and
 * topic file once, about 30 small requests today.
 */

import { OTHER } from './decide';
import type { GitHubClient, TreeEntry } from './github';
import { isRecord } from './http';
import { type KvStore, readJson, writeJson } from './ledger';
import { normaliseText } from './text';

export const VIDEOS_DIR = 'src/content/videos/';
export const TOPICS_DIR = 'src/content/topics/';
const VIDEO_ID_CACHE = 'cache:video-ids';
const TOPIC_CACHE = 'cache:topics';

/** The folder name under src/content/videos, so only characters safe in a path. */
const TOPIC_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface Topic {
  slug: string;
  title: string;
  description: string;
}

export interface RepoSnapshot {
  /** youtubeId → the path of the file that already holds it. */
  videos: Map<string, string>;
  /** Every video file path, so a new file never lands on a taken one. */
  videoPaths: Set<string>;
  topics: Topic[];
  topicSlugs: Set<string>;
  /** Blobs read from GitHub this run (cache misses). */
  reads: number;
  warnings: string[];
}

export async function loadSnapshot(github: GitHubClient, kv: KvStore): Promise<RepoSnapshot> {
  const blobs = (await github.listTree()).filter((entry) => entry.type === 'blob');
  const videoFiles = blobs.filter((e) => e.path.startsWith(VIDEOS_DIR) && e.path.endsWith('.mdx'));
  const topicFiles = blobs.filter((e) => e.path.startsWith(TOPICS_DIR) && e.path.endsWith('.json'));

  const ids = await readThroughCache(kv, VIDEO_ID_CACHE, videoFiles, async (sha) =>
    extractYoutubeId(await github.readBlob(sha)),
  );
  const parsedTopics = await readThroughCache(kv, TOPIC_CACHE, topicFiles, async (sha) =>
    parseTopic(await github.readBlob(sha)),
  );

  const videos = new Map<string, string>();
  for (const file of videoFiles) {
    const id = ids.values.get(file.path);
    if (id && !videos.has(id)) videos.set(id, file.path);
  }

  const warnings: string[] = [];
  const topics: Topic[] = [];
  const topicSlugs = new Set<string>();
  for (const file of topicFiles) {
    const topic = parsedTopics.values.get(file.path);
    if (!topic) {
      warnings.push(`${file.path} is skipped: it needs a title and a lowercase slug other than "${OTHER}"`);
    } else if (topicSlugs.has(topic.slug)) {
      warnings.push(`${file.path} is skipped: another topic already uses the slug "${topic.slug}"`);
    } else {
      topicSlugs.add(topic.slug);
      topics.push(topic);
    }
  }
  // A stable order, so the same branch always produces the same request.
  topics.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

  return {
    videos,
    videoPaths: new Set(videoFiles.map((file) => file.path)),
    topics,
    topicSlugs,
    reads: ids.reads + parsedTopics.reads,
    warnings,
  };
}

/**
 * Look each file up in a KV cache keyed by blob SHA, and read from GitHub
 * only on a miss. SHAs no longer on the branch are dropped, so the cache
 * never outgrows the repository. It is saved even when a read fails part
 * way through, for instance when the run's subrequest budget runs out, so
 * the next run carries on from where this one stopped.
 */
async function readThroughCache<T>(
  kv: KvStore,
  key: string,
  files: TreeEntry[],
  read: (sha: string) => Promise<T | null>,
): Promise<{ values: Map<string, T | null>; reads: number }> {
  const cache = (await readJson<Record<string, T | null>>(kv, key)) ?? {};
  const live = new Set(files.map((file) => file.sha));
  let changed = false;
  for (const sha of Object.keys(cache)) {
    if (!live.has(sha)) {
      delete cache[sha];
      changed = true;
    }
  }

  const values = new Map<string, T | null>();
  let reads = 0;
  try {
    for (const file of files) {
      if (!Object.hasOwn(cache, file.sha)) {
        cache[file.sha] = await read(file.sha);
        reads += 1;
        changed = true;
      }
      values.set(file.path, cache[file.sha] ?? null);
    }
  } finally {
    if (changed) await writeJson(kv, key, cache);
  }
  return { values, reads };
}

/**
 * The youtubeId from a video file's frontmatter, as Decap or this Worker
 * wrote it: plain, or in single or double quotes.
 */
export function extractYoutubeId(mdx: string): string | null {
  const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(mdx)?.[1];
  if (frontmatter === undefined) return null;
  const value = /^youtubeId:[ \t]*(.*?)[ \t]*\r?$/m.exec(frontmatter)?.[1] ?? '';
  const unquoted = /^"(.*)"$/.exec(value)?.[1] ?? /^'(.*)'$/.exec(value)?.[1] ?? value;
  return unquoted.trim() || null;
}

/**
 * A topic file's title, slug and description. The slug is the JSON's `slug`
 * field, not the filename: public-choice.json has the slug "pubc", and that
 * is the folder its videos live in. Descriptions written in the CMS can
 * carry stray double or trailing spaces, so text is normalised.
 */
export function parseTopic(json: string): Topic | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  const slug = typeof data.slug === 'string' ? data.slug.trim() : '';
  const title = typeof data.title === 'string' ? normaliseText(data.title) : '';
  const description = typeof data.description === 'string' ? normaliseText(data.description) : '';
  if (!TOPIC_SLUG.test(slug) || slug === OTHER || !title) return null;
  return { slug, title, description };
}
