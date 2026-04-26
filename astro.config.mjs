// @ts-check
import { defineConfig } from 'astro/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import rehypeExternalLinks from './src/lib/rehype-external-links.ts';
import rehypeGlossary from './src/lib/rehype-glossary.ts';

const siteUrl = 'https://liberty-lighthouse.vercel.app';
const siteHostname = new URL(siteUrl).hostname;

// Read glossary entries directly from the filesystem so the rehype plugin
// has its alias table ready when MDX files start compiling. We can't use
// `astro:content` here — collections aren't bootstrapped yet at config load.
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const glossaryDir = join(__dirname, 'src/content/glossary');

function loadGlossaryEntries() {
  let files;
  try {
    files = readdirSync(glossaryDir).filter((f) => /\.mdx?$/.test(f));
  } catch {
    return [];
  }
  return files
    .map((f) => {
      const slug = f.replace(/\.mdx?$/, '');
      const raw = readFileSync(join(glossaryDir, f), 'utf8');
      const { data } = matter(raw);
      return {
        slug,
        term: data.term ?? '',
        aliases: Array.isArray(data.aliases) ? data.aliases : [],
        draft: Boolean(data.draft),
      };
    })
    .filter((e) => !e.draft && e.term);
}

const glossaryEntries = loadGlossaryEntries();

export default defineConfig({
  site: siteUrl,
  integrations: [
    mdx({
      rehypePlugins: [
        [rehypeGlossary, { entries: glossaryEntries }],
        [rehypeExternalLinks, { siteHostname }],
      ],
    }),
    preact(),
    sitemap(),
  ],
  server: { port: 3219 },
  vite: {
    plugins: [tailwindcss()],
  },
});
