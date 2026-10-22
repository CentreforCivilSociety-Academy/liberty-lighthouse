/**
 * A read-only stand-in for the GitHub client, for deployments that must not
 * depend on GitHub at all (REPO_SOURCE "snapshot").
 *
 * `npm run snapshot` copies the topic and video files of a git ref into KV
 * under SNAPSHOT_KEY, with their real blob SHAs. This client serves the tree
 * and blobs from that copy, so loadSnapshot and its caches work unchanged.
 * The copy is only as fresh as the last `npm run snapshot`: a video an editor
 * adds later is unknown to it, which is harmless here because a snapshot
 * deployment always runs in stage mode and writes nothing.
 */

import type { GitHubClient, TreeEntry } from './github';
import { isRecord } from './http';
import type { KvStore } from './ledger';

export const SNAPSHOT_KEY = 'repo:snapshot';

export interface RepoCopy {
  /** The git ref and commit the files were copied from, and when. */
  ref: string;
  commit: string;
  createdAt: string;
  files: Array<{ path: string; sha: string; content: string }>;
}

export function createSnapshotRepo(kv: KvStore): GitHubClient & { describe(): Promise<Omit<RepoCopy, 'files'>> } {
  let copy: Promise<RepoCopy> | undefined;
  const load = () => (copy ??= readCopy(kv));
  const readOnly = (): never => {
    throw new Error('the repository snapshot is read-only');
  };

  return {
    async describe() {
      const { ref, commit, createdAt } = await load();
      return { ref, commit, createdAt };
    },
    async listTree(): Promise<TreeEntry[]> {
      return (await load()).files.map(({ path, sha }) => ({ path, type: 'blob', sha }));
    },
    async readBlob(sha) {
      const file = (await load()).files.find((entry) => entry.sha === sha);
      if (!file) throw new Error(`blob ${sha} is not in the repository snapshot`);
      return file.content;
    },
    defaultBranch: readOnly,
    readFile: readOnly,
    createFile: readOnly,
  };
}

async function readCopy(kv: KvStore): Promise<RepoCopy> {
  const text = await kv.get(SNAPSHOT_KEY);
  if (text === null) throw new Error(`no repository snapshot in KV under "${SNAPSHOT_KEY}"; run \`npm run snapshot\``);
  const data: unknown = JSON.parse(text);
  const valid =
    isRecord(data) &&
    typeof data.ref === 'string' &&
    typeof data.commit === 'string' &&
    typeof data.createdAt === 'string' &&
    Array.isArray(data.files) &&
    data.files.every(
      (file) =>
        isRecord(file) && typeof file.path === 'string' && typeof file.sha === 'string' && typeof file.content === 'string',
    );
  if (!valid) throw new Error(`the repository snapshot under "${SNAPSHOT_KEY}" is malformed; run \`npm run snapshot\``);
  return data as unknown as RepoCopy;
}
