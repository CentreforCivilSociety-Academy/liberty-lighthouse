import type { Root, Element, Text, ElementContent, Nodes } from 'hast';
import type { VFile } from 'vfile';
import { findAndReplace } from 'hast-util-find-and-replace';
import { escapeRegExp } from './text.js';

/**
 * Glossary auto-link rehype plugin.
 *
 *   raw text                         wrapped anchor
 *   ─────────                        ──────────────
 *   "...the MSP regime..."     ─▶    "...the <a class="glossary-term"
 *                                       data-glossary-slug="msp"
 *                                       href="/glossary/msp/">MSP</a> regime..."
 *
 * Behaviour:
 *   - First occurrence per file (per slug). Subsequent matches in the same file
 *     are left alone to avoid visual noise.
 *   - Static skip zones via `ignore`: a, code, pre, h1-h6.
 *   - Dynamic skip: any element with [data-no-gloss] (also handled by `ignore`),
 *     so authors can wrap a throwaway mention with `<span data-no-gloss>...</span>`
 *     to force the link onto a more meaningful occurrence.
 *   - Self-skip: when processing the term's own glossary entry file, a match
 *     that points back to the current slug is left as plain text.
 *   - Longest-match-first: variants sorted by length descending so
 *     "Minimum Support Price" matches before a hypothetical "Price" alias.
 *   - Case-insensitive matching, original case preserved in output.
 *   - Alias-collision detection at plugin init throws a build error naming
 *     both slugs if any (term ∪ aliases) value is shared across two entries.
 */

export interface GlossaryEntryInput {
  slug: string;
  term: string;
  aliases?: string[];
}

interface Variant {
  pattern: string;
  slug: string;
  length: number;
}

export interface RehypeGlossaryOptions {
  entries: GlossaryEntryInput[];
  /** Override how the plugin derives the current entry's slug from the VFile. */
  resolveCurrentSlug?: (file: VFile) => string | null;
}

/** Build the variant table. Throws on alias collisions. Exported for unit testing. */
export function buildVariants(entries: GlossaryEntryInput[]): {
  variants: Variant[];
  regex: RegExp | null;
  variantToSlug: Map<string, string>;
} {
  const namespace = new Map<string, string>();
  const variants: Variant[] = [];

  for (const entry of entries) {
    const all = [entry.term, ...(entry.aliases ?? [])];
    for (const raw of all) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (trimmed.length > 60) {
        throw new Error(
          `[rehype-glossary] alias too long (>60 chars) for slug "${entry.slug}": "${trimmed}"`,
        );
      }
      const key = trimmed.toLowerCase();
      const existing = namespace.get(key);
      if (existing && existing !== entry.slug) {
        throw new Error(
          `[rehype-glossary] alias collision: "${trimmed}" is claimed by both "${existing}" and "${entry.slug}"`,
        );
      }
      namespace.set(key, entry.slug);
      variants.push({
        pattern: escapeRegExp(trimmed),
        slug: entry.slug,
        length: trimmed.length,
      });
    }
  }

  if (!variants.length) {
    return { variants: [], regex: null, variantToSlug: namespace };
  }

  variants.sort((a, b) => b.length - a.length);
  const alternation = variants.map((v) => v.pattern).join('|');
  const regex = new RegExp(`\\b(?:${alternation})\\b`, 'gi');
  return { variants, regex, variantToSlug: namespace };
}

function deriveCurrentSlugFromVFile(file: VFile): string | null {
  const path = file.path || '';
  const match = path.match(/[\/\\]content[\/\\]glossary[\/\\]([^\/\\]+)\.mdx?$/i);
  return match ? match[1] : null;
}

const STATIC_SKIP_TAGS = new Set(['a', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function isIgnored(node: Nodes): boolean {
  if (node.type !== 'element') return false;
  const el = node as Element;
  if (STATIC_SKIP_TAGS.has(el.tagName)) return true;
  const props = el.properties;
  if (!props) return false;
  // hast lowercases data-* attribute names into camelCase: data-no-gloss → dataNoGloss.
  if (props.dataNoGloss !== undefined) return true;
  return false;
}

export default function rehypeGlossary(options: RehypeGlossaryOptions) {
  const { entries, resolveCurrentSlug = deriveCurrentSlugFromVFile } = options;
  const { regex, variantToSlug } = buildVariants(entries);

  return (tree: Root, file: VFile) => {
    if (!regex) return; // empty glossary: no-op

    const currentSlug = resolveCurrentSlug(file);
    const wrappedSlugs = new Set<string>();

    findAndReplace(
      tree,
      [
        [
          regex,
          (match: string) => {
            const slug = variantToSlug.get(match.toLowerCase());
            if (!slug) return false;

            // Self-skip: don't wrap the term's own definition page.
            if (currentSlug && currentSlug === slug) return false;

            // First-occurrence-only-per-file.
            if (wrappedSlugs.has(slug)) return false;
            wrappedSlugs.add(slug);

            const anchor: Element = {
              type: 'element',
              tagName: 'a',
              properties: {
                className: ['glossary-term'],
                href: `/glossary/${slug}/`,
                'data-glossary-slug': slug,
              },
              children: [{ type: 'text', value: match } as Text],
            };
            return anchor as ElementContent;
          },
        ],
      ],
      { ignore: isIgnored },
    );
  };
}
