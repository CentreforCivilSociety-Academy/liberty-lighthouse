import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import rehypeGlossary from './rehype-glossary.js';
import rehypeTableResponsive from './rehype-table-responsive.js';
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
 *
 * This pipeline is assembled by hand, so anything Astro gives the MDX files
 * for free has to be asked for here. Two things were missing, and both meant
 * a syllabus behaved unlike every other page:
 *
 * - remark-gfm. Without it a Markdown table is not a table. A syllabus
 *   written with pipes rendered as a paragraph of literal | characters.
 * - rehype-raw. `allowDangerousHtml` passes HTML through as opaque text, so
 *   a table pasted as HTML was never parsed into elements and no plugin
 *   could see it, styled or otherwise.
 */
export async function renderMarkdownWithGlossary(md: string): Promise<string> {
  if (!md || !md.trim()) return '';
  const entries = await loadEntries();
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    // Parse that raw HTML into real nodes before anything tries to read it.
    .use(rehypeRaw)
    .use(rehypeGlossary, { entries, resolveCurrentSlug: () => null })
    .use(rehypeTableResponsive)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(file);
}
