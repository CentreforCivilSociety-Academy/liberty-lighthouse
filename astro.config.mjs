// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import rehypeExternalLinks from './src/lib/rehype-external-links.ts';

const siteUrl = 'https://libertylighthouse.ccs.in';
const siteHostname = new URL(siteUrl).hostname;

export default defineConfig({
  site: siteUrl,
  integrations: [
    mdx({
      rehypePlugins: [[rehypeExternalLinks, { siteHostname }]],
    }),
    preact(),
    sitemap(),
  ],
  server: { port: 3219 },
  vite: {
    plugins: [tailwindcss()],
  },
});
