import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { load } from 'js-yaml';
import { FALLBACK_IDS } from '../../src/lib/leader';

/**
 * References to content, checked against the content.
 *
 * Renaming 134 FAQ files broke three things at once and none of them raised an
 * error. An approved comment stopped rendering, because a comment stores the
 * slug of the page it belongs to. The homepage's chosen lead question was
 * replaced by whichever question happened to sort first, because the front
 * page stores slugs too and quietly falls back when one dangles. The vetted
 * fallbacks were stale as well, so the fallback chain had nothing to catch it.
 *
 * Every one of these is a stored string pointing at a file. Nothing in the
 * build objected to any of them pointing nowhere.
 */

const root = (p: string) => resolve(process.cwd(), p);
const frontmatter = (p: string) =>
  (load(readFileSync(p, 'utf8').split(/^---$/m)[1] ?? '') ?? {}) as Record<string, any>;

const walk = (dir: string, ext: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p, ext) : e.name.endsWith(ext) ? [p] : [];
  });

const idsIn = (dir: string, ext: string) =>
  new Set(walk(root(dir), ext).map((p) => p.slice(root(dir).length + 1).replace(new RegExp(`\\${ext}$`), '')));

const faqIds = idsIn('src/content/faqs', '.mdx');
const videoIds = idsIn('src/content/videos', '.mdx');
const termIds = idsIn('src/content/glossary', '.mdx');
const topicSlugs = new Set(
  readdirSync(root('src/content/topics'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(root(`src/content/topics/${f}`), 'utf8')).slug),
);

describe('the front page points at questions that exist', () => {
  const frontpage = JSON.parse(readFileSync(root('src/content/settings/frontpage.json'), 'utf8'));

  it.each(Object.entries(frontpage) as Array<[string, string]>)(
    'the %s slot resolves',
    (slot, id) => {
      expect(faqIds, `frontpage.json ${slot} points at nothing; the homepage will silently show another question`).toContain(id);
    },
  );

  it('the vetted fallbacks resolve', () => {
    // These catch a dangling slot. If they dangle too, the front page picks
    // whatever sorts first and nobody at CCS chose it.
    expect(FALLBACK_IDS.filter((id) => !faqIds.has(id))).toEqual([]);
  });

  it('has a fallback for every slot it fills', () => {
    expect(FALLBACK_IDS.length).toBeGreaterThanOrEqual(Object.keys(frontpage).length);
  });
});

describe('cross-references between entries', () => {
  const entries = [
    ...walk(root('src/content/faqs'), '.mdx'),
    ...walk(root('src/content/videos'), '.mdx'),
    ...walk(root('src/content/glossary'), '.mdx'),
  ];

  const dangling = (key: string, known: Set<string>) =>
    entries.flatMap((p) => ((frontmatter(p)[key] ?? []) as string[])
      .filter((v) => !known.has(v))
      .map((v) => `${p.replace(`${process.cwd()}/`, '')}: ${key} "${v}"`));

  it('relatedFAQs all resolve', () => expect(dangling('relatedFAQs', faqIds)).toEqual([]));
  it('relatedVideos all resolve', () => expect(dangling('relatedVideos', videoIds)).toEqual([]));
  it('relatedTerms all resolve', () => expect(dangling('relatedTerms', termIds)).toEqual([]));

  it('every entry belongs to a real topic', () => {
    const orphans = [...walk(root('src/content/faqs'), '.mdx'), ...walk(root('src/content/videos'), '.mdx')]
      .map((p) => [p, frontmatter(p).topic] as const)
      .filter(([, t]) => t && !topicSlugs.has(t))
      .map(([p, t]) => `${p.replace(`${process.cwd()}/`, '')}: topic "${t}"`);
    expect(orphans).toEqual([]);
  });
});

describe('comments point at the page they were left on', () => {
  const files = walk(root('src/content/comments'), '.md');

  it('every comment resolves', () => {
    const known: Record<string, Set<string>> = { faq: faqIds, video: videoIds, glossary: termIds };
    const orphans = files
      .map((p) => [p, frontmatter(p)] as const)
      .filter(([, d]) => d.page_type && !known[d.page_type]?.has(d.page_id))
      .map(([p, d]) => `${p.replace(`${process.cwd()}/`, '')}: ${d.page_type} "${d.page_id}"`);
    // An orphaned comment is approved, stored, and invisible.
    expect(orphans).toEqual([]);
  });
});

describe('the CMS slugs to the same characters Astro publishes', () => {
  const config = load(readFileSync(root('public/admin/config.yml'), 'utf8')) as any;

  it('slugs to ASCII', () => {
    // Decap's default keeps accents in the filename; Astro strips them from
    // the route. The file and the URL then disagree, which is how two FAQs
    // published under paths containing é and ï.
    expect(config.slug?.encoding, 'public/admin/config.yml needs a global slug block').toBe('ascii');
    expect(config.slug?.clean_accents).toBe(true);
  });
});
