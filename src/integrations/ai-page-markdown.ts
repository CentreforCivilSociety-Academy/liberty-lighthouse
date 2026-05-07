import type { AstroIntegration } from 'astro';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';

/**
 * After build, derive `dist/ai.md` from the rendered `dist/ai/index.html` so
 * the markdown variant of the AI/MCP page tracks the page itself. Any future
 * edit to `src/pages/ai.astro` propagates to the .md without a parallel
 * writer to keep in sync.
 *
 * Strategy:
 * - Pull `<main id="main-content">…</main>` from the rendered HTML.
 * - Strip decorative elements that wouldn't translate (SVG icons, hero
 *   background overlays, the live-dot, decorative rule lines).
 * - Convert to markdown with Turndown.
 * - Collapse runs of blank lines and prepend a small generation header.
 *
 * Dev-mode caveat: the file only exists after a real build. `astro dev`
 * will 404 on /ai.md.
 */
export function aiPageMarkdown(): AstroIntegration {
  return {
    name: 'ai-page-markdown',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const htmlPath = join(distDir, 'ai', 'index.html');
        const mdPath = join(distDir, 'ai.md');

        let html: string;
        try {
          html = await readFile(htmlPath, 'utf8');
        } catch (err) {
          logger.warn(
            `ai-page-markdown: could not read ${htmlPath} (${String(err)}); skipping.`,
          );
          return;
        }

        const mainMatch = html.match(
          /<main\s+id="main-content"[^>]*>([\s\S]*?)<\/main>/i,
        );
        if (!mainMatch) {
          logger.warn(
            'ai-page-markdown: <main id="main-content"> not found in /ai/index.html; skipping.',
          );
          return;
        }

        let content = mainMatch[1];

        // Strip decorative HTML that wouldn't translate to useful markdown.
        // Order matters — broader patterns (svg) before narrower ones.
        content = content
          // SVG icons everywhere (cards, status timeline, etc.)
          .replace(/<svg[\s\S]*?<\/svg>/gi, '')
          // Hero noise overlay (inline style with data: SVG)
          .replace(
            /<div[^>]*class="[^"]*absolute inset-0[^"]*"[^>]*style="[^"]*background-image[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
            '',
          )
          // Hero horizon glow div (empty, decorative)
          .replace(
            /<div[^>]*class="[^"]*ai-horizon[^"]*"[^>]*><\/div>/gi,
            '',
          )
          // Decorative rule-line spans on either side of the hero diamond
          .replace(
            /<span[^>]*class="[^"]*ai-rule-line[^"]*"[^>]*><\/span>/gi,
            '',
          )
          // Live-dot pulse
          .replace(
            /<span[^>]*class="[^"]*animate-pulse[^"]*"[^>]*><\/span>/gi,
            '',
          )
          // Stray <style> blocks if Astro inlined any
          .replace(/<style[\s\S]*?<\/style>/gi, '');

        const td = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
          bulletListMarker: '-',
          emDelimiter: '_',
        });

        // Drop the View-as-MD / Copy toolbar from the markdown — a UI affordance,
        // not content.
        td.addRule('strip-md-actions', {
          filter: (node) =>
            node.nodeName === 'DIV' &&
            (node as Element).getAttribute?.('data-ai-md-actions') !== null,
          replacement: () => '',
        });

        let md = td.turndown(content);
        md = md.replace(/\n{3,}/g, '\n\n').trim() + '\n';

        const header = [
          '<!--',
          '  Generated from /ai/ at build time. Source: src/pages/ai.astro.',
          '  Canonical: https://liberty-lighthouse.vercel.app/ai/',
          '-->',
          '',
        ].join('\n');

        await writeFile(mdPath, header + '\n' + md, 'utf8');
        logger.info(
          `ai-page-markdown: wrote ${mdPath} (${(header.length + md.length).toLocaleString()} chars)`,
        );
      },
    },
  };
}
