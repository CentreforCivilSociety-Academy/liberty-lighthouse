import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeGlossary from './rehype-glossary.js';
import { getAllGlossary, getSlugFromId } from './collections.js';

let cachedEntries: { slug: string; term: string; aliases: string[] }[] | null = null;

async function loadEntries() {
  if (cachedEntries) return cachedEntries;
  const all = await getAllGlossary();
  cachedEntries = all.map((g) => ({
    slug: getSlugFromId(g.id),
    term: g.data.term,
    aliases: g.data.aliases ?? [],
  }));
  return cachedEntries;
}

/**
 * Render a markdown string to HTML, running the glossary auto-link
 * pass over the result. Used by surfaces that don't go through the
 * MDX pipeline (e.g., topic syllabi rendered from a frontmatter string).
 */
export async function renderMarkdownWithGlossary(md: string): Promise<string> {
  if (!md || !md.trim()) return '';
  const entries = await loadEntries();
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeGlossary, { entries, resolveCurrentSlug: () => null })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(file);
}
