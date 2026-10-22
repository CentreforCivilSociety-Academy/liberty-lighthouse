/**
 * Evaluate the classifier against examples whose topic a person has decided.
 *
 * Replays labelled examples through exactly the request the Worker sends
 * (buildDecisionRequest) and scores the answers exactly the way the Worker
 * does (decide), so what is measured here is what runs in production.
 *
 * Four labelled sets:
 *   site-videos  every video already on the site, filed by CCS editors;
 *   new-shorts   the channel's recent Shorts not yet on the site, labelled
 *                by hand in eval-labels.json (with acceptable alternatives
 *                where a video genuinely spans two topics);
 *   negatives    uploads that must never be filed: a real unrelated channel
 *                that also calls itself "libertylighthouse", plus the kinds of
 *                announcement and event upload an explainer channel posts;
 *   faq-proxies  every published question, as title plus the opening of its
 *                answer: not videos, but the same short text against the
 *                same taxonomy, which tests whether the topics separate.
 *
 * Raw answers are saved alongside the summary, so thresholds can be
 * re-tuned later without paying for the requests again.
 *
 * Usage (from workers/youtube-sync, key in the environment, never on argv):
 *   OPENROUTER_API_KEY=… ../../node_modules/.bin/tsx scripts/evaluate.ts [--sets site-videos,new-shorts,faq-proxies]
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDecisionRequest, DECISIONS_URL, readUsage } from '../src/jev';
import { decide } from '../src/decide';
import { parseFeed } from '../src/feed';
import { parseTopic, type Topic } from '../src/repo';
import { DEFAULTS } from '../src/config';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '..');
const repo = resolve(pkg, '../..');
// The Worker's own defaults, so the evaluation measures what is deployed.
const MODEL = process.env.JEV_MODEL || DEFAULTS.jevModel;
const AUTO_CONFIDENCE = Number(process.env.AUTO_CONFIDENCE || DEFAULTS.autoConfidence);
const CONCURRENCY = 6;

const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error('Set OPENROUTER_API_KEY in the environment.');

const setsArg = process.argv.find((a) => a.startsWith('--sets='))?.split('=')[1];
const wanted = new Set((setsArg ?? 'site-videos,new-shorts,negatives,faq-proxies').split(','));

// ── The taxonomy, as the Worker would read it from the branch ──
const topics: Topic[] = readdirSync(join(repo, 'src/content/topics'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseTopic(readFileSync(join(repo, 'src/content/topics', f), 'utf8')))
  .filter((t): t is Topic => t !== null)
  .sort((a, b) => a.slug.localeCompare(b.slug));

/** Frontmatter field reader for the repo's simple, Decap-written YAML. */
function field(mdx: string, name: string): string {
  const fm = /^---\n([\s\S]*?)\n---/.exec(mdx)?.[1] ?? '';
  const lines = fm.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`${name}:`));
  if (start < 0) return '';
  let value = lines[start].slice(name.length + 1).trim();
  for (let i = start + 1; i < lines.length && /^\s+\S/.test(lines[i]); i += 1) value += ' ' + lines[i].trim();
  return value.replace(/^["']|["']$/g, '').trim();
}

type Example = {
  set: string;
  id: string;
  title: string;
  description: string;
  label: string;
  /** Other topics a careful editor could defend. */
  alternatives: string[];
};

const examples: Example[] = [];

if (wanted.has('site-videos')) {
  const root = join(repo, 'src/content/videos');
  for (const topic of readdirSync(root)) {
    for (const file of readdirSync(join(root, topic)).filter((f) => f.endsWith('.mdx'))) {
      const mdx = readFileSync(join(root, topic, file), 'utf8');
      if (field(mdx, 'draft') === 'true') continue;
      examples.push({
        set: 'site-videos',
        id: field(mdx, 'youtubeId'),
        title: field(mdx, 'title'),
        description: field(mdx, 'description'),
        label: field(mdx, 'topic'),
        alternatives: [],
      });
    }
  }
}

if (wanted.has('new-shorts')) {
  const labels = JSON.parse(readFileSync(join(here, 'eval-labels.json'), 'utf8')) as Record<
    string,
    { topic: string; alternatives?: string[]; note?: string }
  >;
  const feed = parseFeed(readFileSync(join(pkg, 'test/fixtures/ccs-feed.xml'), 'utf8'));
  for (const entry of feed) {
    const l = labels[entry.videoId];
    if (!l) continue;
    examples.push({
      set: 'new-shorts',
      id: entry.videoId,
      title: entry.title,
      description: entry.description,
      label: l.topic,
      alternatives: l.alternatives ?? [],
    });
  }
}

if (wanted.has('negatives')) {
  // Must never be filed under a topic: a real unrelated channel that also
  // calls itself "libertylighthouse" (the risk of configuring the wrong
  // channel), and the kinds of upload an explainer channel also posts.
  const unrelated = parseFeed(readFileSync(join(pkg, 'test/fixtures/unrelated-channel-feed.xml'), 'utf8'));
  const synthetic = [
    { id: 'synthetic-social', title: 'CCS Academy is now on Instagram!', description: 'Follow us on Instagram for daily updates, behind-the-scenes clips and event announcements. Link in bio.' },
    { id: 'synthetic-event', title: 'Liberty Lecture 2026 | Full Session', description: 'Full recording of the annual Liberty Lecture held in New Delhi, with opening remarks, the keynote and an audience Q&A.' },
    { id: 'synthetic-bts', title: 'Behind the scenes: how we make our explainers', description: 'A quick look at our studio, our scripts and the team that makes these videos. Thank you for watching and subscribing!' },
  ];
  for (const e of unrelated) examples.push({ set: 'negatives', id: e.videoId, title: e.title, description: e.description, label: 'other', alternatives: [] });
  for (const s of synthetic) examples.push({ set: 'negatives', id: s.id, title: s.title, description: s.description, label: 'other', alternatives: [] });
}

if (wanted.has('faq-proxies')) {
  const root = join(repo, 'src/content/faqs');
  const stripped = (md: string) =>
    md
      .replace(/^---[\s\S]*?---/, '')
      .split(/\n\s*\n/)
      .filter((b) => b.trim() && !/^(#|[-*+] |\d+\. |\||!\[|<)/.test(b.trim()))
      .join(' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`]/g, '')
      .replace(/\\(.)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  for (const topic of readdirSync(root)) {
    for (const file of readdirSync(join(root, topic)).filter((f) => f.endsWith('.mdx'))) {
      const mdx = readFileSync(join(root, topic, file), 'utf8');
      if (field(mdx, 'draft') === 'true') continue;
      // Skip continuation parts: they repeat their stem's question.
      if (/\(\s*part\s*\d+\s*\)\s*$/i.test(field(mdx, 'question'))) continue;
      const opening = stripped(mdx).split(/\s+/).slice(0, 60).join(' ');
      examples.push({
        set: 'faq-proxies',
        id: `${topic}/${file.replace(/\.mdx$/, '')}`,
        title: field(mdx, 'question'),
        description: opening,
        label: field(mdx, 'topic'),
        alternatives: [],
      });
    }
  }
}

type Result = Example & {
  status: number;
  verdict: ReturnType<typeof decide>;
  raw: unknown;
  usage: ReturnType<typeof readUsage>;
  correct: boolean;
  acceptable: boolean;
};

async function classifyOne(ex: Example): Promise<Result> {
  const body = buildDecisionRequest(
    { title: ex.title, description: ex.description, format: 'short', published: '' },
    topics,
    MODEL,
  );
  let res: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    res = await fetch(DECISIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://www.libertylighthouse.in',
        'X-Title': 'Liberty Lighthouse YouTube sync (evaluation)',
      },
      body: JSON.stringify(body),
    });
    if (![429, 500, 502, 503, 524, 529].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  const raw = await res!.json().catch(() => null);
  const verdict = decide(raw, { topicSlugs: topics.map((t) => t.slug), autoConfidence: AUTO_CONFIDENCE });
  const chosen = verdict.outcome === 'invalid' ? null : verdict.topic;
  // A negative is handled correctly when the Worker would write no file at
  // all, whichever topic Jev named.
  const kept = verdict.outcome !== 'invalid' && verdict.reason === 'out_of_scope';
  const correct = ex.set === 'negatives' ? kept : chosen === ex.label;
  return {
    ...ex,
    status: res!.status,
    verdict,
    raw,
    usage: readUsage(raw),
    correct,
    acceptable: correct || (chosen !== null && ex.alternatives.includes(chosen)),
  };
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const started = Date.now();
const results = await pool(examples, CONCURRENCY, classifyOne);

// ── Summary ──
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
const lines: string[] = [];
const cost = results.reduce((s, r) => s + (r.usage.cost ?? 0), 0);
const tokens = results.reduce((s, r) => s + (r.usage.inputTokens ?? 0), 0);
const snapshot = results.find((r) => r.usage.model)?.usage.model ?? MODEL;

lines.push(`model ${snapshot}; auto-confidence ${AUTO_CONFIDENCE}; ${results.length} requests in ${((Date.now() - started) / 1000).toFixed(1)}s`);
lines.push(`cost $${cost.toFixed(6)}; input tokens ${tokens} (mean ${(tokens / Math.max(1, results.length)).toFixed(0)}/request)`);
for (const set of ['site-videos', 'new-shorts', 'negatives', 'faq-proxies']) {
  const rs = results.filter((r) => r.set === set);
  if (!rs.length) continue;
  const invalid = rs.filter((r) => r.verdict.outcome === 'invalid');
  const confident = rs.filter((r) => r.verdict.outcome === 'confident');
  const review = rs.filter((r) => r.verdict.outcome === 'needs_review');
  lines.push(
    `\n## ${set}: ${rs.length} examples`,
    `top-1 correct ${rs.filter((r) => r.correct).length}/${rs.length} (${pct(rs.filter((r) => r.correct).length, rs.length)}); acceptable ${pct(rs.filter((r) => r.acceptable).length, rs.length)}`,
    `confident ${confident.length} → correct ${confident.filter((r) => r.correct).length} (${pct(confident.filter((r) => r.correct).length, confident.length)}), acceptable ${pct(confident.filter((r) => r.acceptable).length, confident.length)}`,
    `needs_review ${review.length} → correct ${review.filter((r) => r.correct).length}; reasons ${JSON.stringify(review.reduce((m, r) => ({ ...m, [String((r.verdict as { reason: string }).reason)]: ((m as Record<string, number>)[String((r.verdict as { reason: string }).reason)] ?? 0) + 1 }), {}))}`,
    `invalid ${invalid.length}${invalid.length ? ' ' + JSON.stringify(invalid.map((r) => (r.verdict as { reason: string }).reason)) : ''}`,
  );
  for (const r of rs.filter((r) => !r.correct || set === 'new-shorts')) {
    const v = r.verdict;
    const conf = v.outcome === 'invalid' ? 'invalid' : `${v.outcome}${v.reason ? `/${v.reason}` : ''} c=${v.confidence ?? '–'} in=${v.inScope.toFixed(2)} 2nd=${v.runnerUp ? `${v.runnerUp.topic}:${v.runnerUp.probability.toFixed(2)}` : '–'}`;
    lines.push(`  ${r.correct ? 'OK ' : r.acceptable ? 'ALT' : 'NO '} ${r.label} → ${v.outcome === 'invalid' ? '?' : v.topic}  [${conf}]  ${r.title.slice(0, 80)}`);
  }
}

// Confidence bands across every valid answer: is high confidence earned?
const valid = results.filter((r) => r.set !== 'negatives' && r.verdict.outcome !== 'invalid' && r.verdict.confidence !== null);
const bands = [0, 0.5, 0.7, 0.8, 0.9, 0.95, 1.0001];
lines.push('\n## accuracy by confidence band (all sets)');
for (let i = 0; i < bands.length - 1; i += 1) {
  const inBand = valid.filter((r) => {
    const c = (r.verdict as { confidence: number }).confidence;
    return c >= bands[i] && c < bands[i + 1];
  });
  lines.push(`  [${bands[i].toFixed(2)}, ${Math.min(1, bands[i + 1]).toFixed(2)}${bands[i + 1] > 1 ? ']' : ')'}  n=${inBand.length}  correct ${pct(inBand.filter((r) => r.correct).length, inBand.length)}`);
}

const outDir = join(here, 'eval-out');
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
// Compact on purpose: the labels and Jev's raw answers are all a re-tune
// needs. The titles and descriptions live in the repo and the feed fixture.
const compact = results.map((r) => ({
  set: r.set,
  id: r.id,
  label: r.label,
  alternatives: r.alternatives,
  answers: (r.raw as { answers?: unknown } | null)?.answers ?? null,
  status: r.status,
  inputTokens: r.usage.inputTokens,
  cost: r.usage.cost,
}));
writeFileSync(
  join(outDir, `results-${stamp}.json`),
  JSON.stringify({ model: snapshot, autoConfidence: AUTO_CONFIDENCE, topics: topics.map((t) => t.slug), results: compact }),
);
writeFileSync(join(outDir, `summary-${stamp}.txt`), lines.join('\n') + '\n');
console.log(lines.join('\n'));
