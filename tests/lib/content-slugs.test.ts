import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { load } from 'js-yaml';

/**
 * Slugs are URLs, and these were not slugs.
 *
 * Decap builds `{{slug}}` from the collection's identifier field, which
 * defaults to a field named "title". The faqs collection has "question"
 * instead, so Decap found no identifier and serialised the entire entry into
 * the filename. 114 of 143 FAQs were created that way and published at paths
 * like:
 *
 *   /topics/gst/faq/map-order-1-draft-false-topic-gst-question-why-are-…
 *
 * The median URL on the site was 272 characters and carried the answer's body
 * text and the draft flag. These assert the cause is fixed and stays fixed.
 */

const CONFIG = readFileSync(resolve(process.cwd(), 'public/admin/config.yml'), 'utf8');
const config = load(CONFIG) as {
  collections: Array<{
    name: string;
    slug?: string;
    identifier_field?: string;
    fields?: Array<{ name?: string }>;
  }>;
};

/** Decap's defaults, in the order it tries them. */
const DEFAULT_IDENTIFIERS = ['title', 'name'];

describe('CMS slugs', () => {
  const templated = config.collections.filter((c) => c.slug?.includes('{{slug}}'));

  it('covers every collection that slugs from an identifier', () => {
    expect(templated.length).toBeGreaterThan(0);
  });

  it.each(templated.map((c) => [c.name, c] as const))(
    '%s can resolve an identifier field',
    (name, collection) => {
      const declared = collection.identifier_field;
      const top = (collection.fields ?? []).map((f) => f.name);
      const fallback = DEFAULT_IDENTIFIERS.find((f) => top.includes(f));

      expect(
        declared ?? fallback,
        `${name} uses {{slug}} but has no identifier_field and no top-level ` +
          `${DEFAULT_IDENTIFIERS.join('/')} field. Decap will serialise the whole ` +
          'entry into the filename.',
      ).toBeTruthy();

      // A declared identifier has to name a field that actually exists.
      if (declared) expect(top, `${name}.identifier_field`).toContain(declared);
    },
  );
});

describe('published FAQ slugs', () => {
  const root = resolve(process.cwd(), 'src/content/faqs');
  const files = readdirSync(root)
    .filter((t) => statSync(join(root, t)).isDirectory())
    .flatMap((topic) =>
      readdirSync(join(root, topic))
        .filter((f) => f.endsWith('.mdx'))
        .map((f) => ({ topic, slug: f.replace(/\.mdx$/, ''), path: join(root, topic, f) })),
    );

  it('reads the whole collection', () => {
    expect(files.length).toBe(143);
  });

  it('are lowercase words joined by single hyphens', () => {
    // Anything else is either a serialised object or a character Astro will
    // rewrite when it builds the route, putting the page and its OG card at
    // different paths.
    const bad = files.filter((f) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug));
    expect(bad.map((f) => `${f.topic}/${f.slug}`)).toEqual([]);
  });

  it('carry no frontmatter keys', () => {
    const leaked = files.filter((f) => /(^|-)(map|order|draft|body)-/.test(f.slug));
    expect(leaked.map((f) => `${f.topic}/${f.slug}`)).toEqual([]);
  });

  it('stay short enough to read in a search result', () => {
    const longest = files.reduce((a, b) => (a.slug.length >= b.slug.length ? a : b));
    expect(longest.slug.length, `${longest.topic}/${longest.slug}`).toBeLessThanOrEqual(110);
  });

  it('are unique within a topic', () => {
    const keys = files.map((f) => `${f.topic}/${f.slug}`);
    expect(keys.length).toBe(new Set(keys).size);
  });

  it('describe the question the page answers', () => {
    // The slug is the question, slugified, truncated on a word boundary, with
    // any "(Part N)" re-appended after the cut so the parts stay distinct.
    const slugify = (s: string) =>
      s
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/['\u2018\u2019\u201c\u201d"]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const PART = /-part-(\d+)$/;
    const QPART = /\s*\(\s*part\s*(\d+)\s*\)\s*$/i;

    const mismatched = files.filter((f) => {
      const fm = readFileSync(f.path, 'utf8').split(/^---$/m)[1] ?? '';
      const question = String((load(fm) as { question?: string })?.question ?? '');

      const wantPart = question.match(QPART)?.[1];
      const gotPart = f.slug.match(PART)?.[1];
      if (wantPart !== gotPart) return true;

      const wantStem = slugify(question.replace(QPART, ''));
      const gotStem = f.slug.replace(PART, '');
      return !wantStem.startsWith(gotStem);
    });
    expect(mismatched.map((f) => `${f.topic}/${f.slug}`)).toEqual([]);
  });
});
