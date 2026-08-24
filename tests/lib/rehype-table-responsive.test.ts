import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import rehypeTableResponsive from '../../src/lib/rehype-table-responsive';

/**
 * A table has to work on a phone whatever shape it arrives in, because nobody
 * writing a FAQ should have to know that a table cannot shrink below the width
 * its columns need. The GST table is eight columns and will not go under
 * 715px; in a phone-width column it spilled ~400px past the text and dragged
 * the page sideways, because nothing above it scrolled or clipped.
 *
 * These cover the shapes CCS can actually produce — Markdown pipes, hand
 * written HTML, and a paste out of Word or Google Docs — rather than only the
 * two tables that happen to exist today.
 */

/** The syllabus pipeline, which is assembled by hand rather than by Astro. */
const render = async (md: string) =>
  String(
    await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeTableResponsive)
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(md),
  );

const run = (tree: any) => {
  (rehypeTableResponsive() as (t: any) => void)(tree);
  return tree;
};
const root = (children: any[]) => ({ type: 'root', children });
const el = (tagName: string, properties: any = {}, children: any[] = []) => ({
  type: 'element', tagName, properties, children,
});
const jsx = (name: string, attributes: any[] = [], children: any[] = []) => ({
  type: 'mdxJsxFlowElement', name, attributes, children,
});
const classOf = (n: any) =>
  n.type === 'element'
    ? [n.properties?.className].flat().join(' ')
    : (n.attributes ?? []).find((a: any) => a.name === 'className')?.value ?? '';

describe('whatever shape the table arrives in', () => {
  it('a Markdown pipe table gets a scroller', async () => {
    const html = await render('| Rate | Goods |\n| --- | --- |\n| 5% | Essentials |');
    expect(html).toContain('table-responsive');
    expect(html).toContain('<table>');
  });

  it('a table written as HTML gets one too', async () => {
    const html = await render('<table><tr><td>Rate</td></tr></table>');
    expect(html).toContain('table-responsive');
  });

  it('a table typed as HTML inside MDX gets one', () => {
    // MDX parses raw HTML as JSX, so it never arrives as a hast element.
    // Matching only `element` — the obvious thing — does nothing at all here.
    const tree = run(root([jsx('table')]));
    expect(classOf(tree.children[0])).toContain('table-responsive');
    expect(tree.children[0].type).toBe('mdxJsxFlowElement');
  });

  it('a table pasted from a word processor loses its baked-in widths', async () => {
    const html = await render(
      '<table width="720" cellpadding="4" cellspacing="0" border="1" bgcolor="#fff">' +
        '<colgroup><col width="240"><col width="480"></colgroup>' +
        '<tr><td style="width:240px;padding:4px">Rate</td>' +
        '<td style="width: 480px; color: red">Goods</td></tr></table>',
    );
    expect(html).toContain('table-responsive');
    for (const gone of ['width="720"', 'cellpadding', 'cellspacing', 'bgcolor', 'width="240"', 'width:240px']) {
      expect(html, `${gone} should have been dropped`).not.toContain(gone);
    }
    // Only the sizing goes. Everything else the author wrote is left alone.
    expect(html).toContain('padding:4px');
    expect(html).toContain('color: red');
  });

  it('keeps percentage widths, which flex, and keeps colspan', async () => {
    const html = await render('<table><tr><td colspan="2" style="width:50%">x</td></tr></table>');
    expect(html).toContain('width:50%');
    expect(html).toContain('colspan="2"');
  });

  it('reaches a table nested inside other content', () => {
    const tree = run(root([el('div', {}, [el('figure', {}, [el('table')])])]));
    expect(classOf(tree.children[0].children[0].children[0])).toContain('table-responsive');
  });

  it('does not wrap a table twice', async () => {
    const once = run(root([el('table')]));
    const twice = run(once);
    expect(classOf(twice.children[0])).toContain('table-responsive');
    expect(classOf(twice.children[0].children[0])).not.toContain('table-responsive');
  });

  it('leaves everything else alone', () => {
    const tree = run(root([el('p'), el('img', { width: 300 }), jsx('Chart')]));
    expect(tree.children.map((c: any) => c.tagName ?? c.name)).toEqual(['p', 'img', 'Chart']);
    // The width strip is for tables. An image's width is the author's business.
    expect(tree.children[1].properties.width).toBe(300);
  });

  it('makes the scroller reachable by keyboard, and names it', () => {
    // A region that scrolls but cannot be focused is one a keyboard user
    // cannot scroll.
    const w = run(root([el('table')])).children[0];
    expect(w.properties.tabIndex).toBe(0);
    expect(w.properties.role).toBe('region');
    expect(String(w.properties['aria-label'])).toMatch(/scroll/i);
  });
});

describe('every render path runs it', () => {
  const config = readFileSync(resolve(process.cwd(), 'astro.config.mjs'), 'utf8');
  const syllabus = readFileSync(resolve(process.cwd(), 'src/lib/render-markdown.ts'), 'utf8');

  it('Markdown and MDX share one plugin list', () => {
    // Declared on mdx() alone, a .md file got none of them.
    const md = config.slice(config.indexOf('markdown:'), config.indexOf('integrations:'));
    expect(md).toContain('rehypeTableResponsive');
    expect(md).toContain('rehypeGlossary');
    expect(config).not.toMatch(/mdx\(\{[\s\S]*rehypePlugins/);
  });

  it('the syllabus renderer runs it too', () => {
    expect(syllabus).toContain('rehypeTableResponsive');
  });

  it('the syllabus renderer can parse a table at all', async () => {
    // Without remark-gfm a pipe table is not a table: it rendered as a
    // paragraph of literal | characters.
    expect(syllabus).toContain('remarkGfm');
    const html = await render('| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(html).toContain('<table>');
    expect(html).not.toContain('| A | B |');
  });

  it('the syllabus renderer parses raw HTML into nodes it can act on', () => {
    // allowDangerousHtml alone passes HTML through as opaque text, so no
    // plugin ever sees a table pasted that way.
    expect(syllabus).toContain('rehypeRaw');
  });
});

describe('the stylesheet backs the wrapper', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
  const block = css.slice(css.indexOf('.table-responsive {'));

  it('scrolls horizontally', () => {
    expect(block.slice(0, 260)).toMatch(/overflow-x:\s*auto/);
  });

  it('breaks a long word in a cell without crushing the table', () => {
    // `anywhere` would also break ordinary words: the eight-column GST table
    // then fitted a phone at 45px per column, headings broken mid-word, and
    // could not be read. Fitting is not the same as working.
    expect(block.slice(0, 1500)).toMatch(/overflow-wrap:\s*break-word/);
    expect(block.slice(0, 1500)).not.toMatch(/overflow-wrap:\s*anywhere/);
  });
});

describe('the census fits the screen it is pinned to', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/home.css'), 'utf8');
  const start = css.indexOf('grid-column: spine');
  const block = css.slice(start, css.indexOf('}', css.indexOf('overscroll-behavior', start)));

  it('scrolls rather than clipping', () => {
    expect(block).toMatch(/overflow-y:\s*auto/);
    expect(block).not.toMatch(/overflow:\s*hidden/);
  });

  it('is still capped, or it would run off the bottom', () => {
    expect(block).toMatch(/max-height:\s*calc\(100dvh/);
  });
});
