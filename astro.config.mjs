// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://libertylighthouse.ccs.in',
  integrations: [mdx(), preact(), sitemap()],
  server: { port: 3219 },
  vite: {
    plugins: [tailwindcss()],
  },
});
