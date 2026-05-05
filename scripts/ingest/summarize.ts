#!/usr/bin/env -S tsx
/**
 * Summarise each Spontaneous Order post into a structured frontmatter block:
 *
 *   summary       — 150–200 word abstract of the post's argument
 *   key_points    — 3–5 single-sentence takeaways
 *   topics        — 2–4 short topic tags
 *   summary_hash  — set to source_hash; when they match, the summary is
 *                   considered up-to-date and the post is skipped on rerun
 *   summary_at    — ISO timestamp
 *
 * Idempotent and hash-skip: only posts whose summary_hash != source_hash
 * (or where summary_hash is missing) are sent to the LLM. Re-running on a
 * fully-summarised corpus is free.
 *
 * Usage:
 *   OPENROUTER_API_KEY=... npm run ingest:summarize -- [--limit N] [--dry-run]
 *
 * Defaults: --source spontaneous-order, --model x-ai/grok-4.1-fast.
 *
 * Cost (Grok 4.1 Fast on OpenRouter, $0.20/M input, $0.50/M output):
 *   ~1500 input tokens × 1093 posts × $0.20/M ≈ $0.33
 *   ~ 200 output tokens × 1093 posts × $0.50/M ≈ $0.11
 *   Total full backfill ≈ $0.44.
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import {
  loadEnv,
  logStep,
  logWarn,
  parseArgs,
  todayIso,
  writeMdxFile,
} from './lib';

const ROOT = resolve(process.cwd());
const DEFAULT_SOURCE_DIR = join(ROOT, 'src/content/external/spontaneous-order');

const SYSTEM_PROMPT = `You are summarising a post from Spontaneous Order, the Centre for Civil Society's Substack on Indian classical-liberal policy. Your output is consumed by a wiki-style agent surface, so faithfulness to the author's argument matters more than editorial polish.

Read the post and output a single JSON object with EXACTLY these fields:

{
  "summary": "150-200 words capturing the central argument and conclusion. Neutral tone, faithful to the author's framing — surface the classical-liberal perspective rather than presenting it as neutral consensus. Include the most important specific facts/numbers when present. No marketing fluff.",
  "key_points": ["3-5 single-sentence takeaways. Concrete, action-oriented or claim-based, not vague."],
  "topics": ["2-4 short kebab-case topic tags, e.g. 'education', 'school-choice', 'agricultural-subsidies', 'free-speech'. Prefer reusable tags that other posts on the same theme would also pick."]
}

Hard rules:
- Output ONLY the JSON object. No prose before or after, no markdown code fences.
- Do not invent facts. If the post is too short or fragmentary to summarise meaningfully, set summary to a brief honest note about that and key_points to a single-item array.
- Do not include URLs in summary or key_points (they're in the source already).`;

interface Summary {
  summary: string;
  key_points: string[];
  topics: string[];
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

function parseLLMOutput(raw: string): Summary | null {
  let text = raw.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (
      parsed &&
      typeof parsed.summary === 'string' &&
      Array.isArray(parsed.key_points) &&
      Array.isArray(parsed.topics)
    ) {
      return {
        summary: parsed.summary.trim(),
        key_points: parsed.key_points.map((s: unknown) => String(s).trim()).filter(Boolean),
        topics: parsed.topics.map((s: unknown) => String(s).trim().toLowerCase()).filter(Boolean),
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function summariseOne(
  body: string,
  title: string,
  model: string,
  apiKey: string,
): Promise<Summary | null> {
  const userText = `# ${title}\n\n${body}`;
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://liberty-lighthouse.vercel.app',
      'X-Title': 'Liberty Lighthouse summarizer',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
      temperature: 0.2,
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`OpenRouter ${r.status}: ${text.slice(0, 200)}`);
  }
  const data = (await r.json()) as OpenRouterResponse;
  if (data.error) throw new Error(data.error.message ?? 'OpenRouter error');
  const content = data.choices?.[0]?.message?.content ?? '';
  return parseLLMOutput(content);
}

async function main() {
  await loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const dir =
    typeof args.dir === 'string' ? resolve(process.cwd(), args.dir as string) : DEFAULT_SOURCE_DIR;
  const limit =
    typeof args.limit === 'string' ? parseInt(args.limit as string, 10) : Infinity;
  const dryRun = Boolean(args['dry-run']);
  const refresh = Boolean(args.refresh);
  const model =
    (args.model as string) || process.env.OPENROUTER_MODEL || 'x-ai/grok-4.1-fast';
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    logWarn('OPENROUTER_API_KEY is not set. Cannot run.');
    process.exit(1);
  }

  logStep(`dir: ${dir}`);
  logStep(`model: ${model}, limit: ${Number.isFinite(limit) ? limit : 'all'}, dry-run: ${dryRun}, refresh: ${refresh}`);

  const { readdir } = await import('node:fs/promises');
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    logWarn(`could not read dir ${dir}: ${(err as Error).message}`);
    process.exit(1);
  }
  const mdFiles = entries.filter((e) => e.endsWith('.md')).sort();
  logStep(`found ${mdFiles.length} .md file(s)`);

  let summarised = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  for (const filename of mdFiles) {
    if (processed >= limit) break;
    processed++;

    const filePath = join(dir, filename);
    const raw = await readFile(filePath, 'utf8');
    const parsed = matter(raw);
    const fm = parsed.data as Record<string, unknown>;
    const body = parsed.content;
    const sourceHash = typeof fm.source_hash === 'string' ? fm.source_hash : null;

    if (!refresh && sourceHash && fm.summary_hash === sourceHash && typeof fm.summary === 'string' && fm.summary.length > 0) {
      skipped++;
      continue;
    }

    const title = typeof fm.title === 'string' ? fm.title : filename.replace(/\.md$/, '');

    try {
      const result = await summariseOne(body, title, model, apiKey);
      if (!result) {
        logWarn(`could not parse summary for ${filename}`);
        failed++;
        continue;
      }
      if (dryRun) {
        logStep(`would summarise ${filename}`);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(result, null, 2));
        summarised++;
        continue;
      }
      const updated: Record<string, unknown> = {
        ...fm,
        summary: result.summary,
        key_points: result.key_points,
        topics: result.topics,
        summary_hash: sourceHash ?? '',
        summary_at: todayIso(),
      };
      // Order frontmatter fields predictably for diff readability.
      const ordered: Record<string, unknown> = {};
      const order = [
        'title',
        'original_url',
        'author',
        'published_at',
        'ingested_at',
        'excerpt',
        'summary',
        'key_points',
        'topics',
        'tags',
        'source_hash',
        'summary_hash',
        'summary_at',
      ];
      for (const k of order) if (k in updated) ordered[k] = updated[k];
      for (const k of Object.keys(updated)) if (!(k in ordered)) ordered[k] = updated[k];

      await writeMdxFile(filePath, { frontmatter: ordered, body });
      summarised++;
      if (summarised % 25 === 0) {
        logStep(`progress: ${summarised} summarised, ${skipped} skipped, ${failed} failed`);
      }
    } catch (err) {
      logWarn(`summarise failed for ${filename}: ${(err as Error).message}`);
      failed++;
    }
  }

  logStep(
    `done. summarised=${summarised} skipped=${skipped} failed=${failed} processed=${processed}/${mdFiles.length}`,
  );
  if (failed > 0) process.exit(2);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
