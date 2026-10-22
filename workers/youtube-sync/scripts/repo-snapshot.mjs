// Copy the topic and video files of a git ref into a JSON file, for a
// REPO_SOURCE "snapshot" deployment (see src/snapshot-repo.ts). `npm run
// snapshot` then puts it in KV. Reads the local clone, so fetch first.
//
// usage: node scripts/repo-snapshot.mjs <ref> <out.json>
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [ref, out] = process.argv.slice(2);
if (!ref || !out) {
  console.error('usage: node scripts/repo-snapshot.mjs <ref> <out.json>');
  process.exit(1);
}

const root = fileURLToPath(new URL('../../..', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const files = git('ls-tree', '-r', ref, '--', 'src/content/topics', 'src/content/videos')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [meta, path] = line.split('\t');
    const [, type, sha] = meta.split(' ');
    return { type, sha, path };
  })
  .filter((entry) => entry.type === 'blob')
  .map(({ sha, path }) => ({ path, sha, content: git('cat-file', 'blob', sha) }));

const copy = { ref, commit: git('rev-parse', ref).trim(), createdAt: new Date().toISOString(), files };
writeFileSync(out, JSON.stringify(copy));
console.log(`${files.length} files from ${ref} (${copy.commit.slice(0, 7)}) written to ${out}`);
