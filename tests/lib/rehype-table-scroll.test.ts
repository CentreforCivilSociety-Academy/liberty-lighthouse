import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import rehypeTableScroll from '../../src/lib/rehype-table-scroll';

/**
 * A table cannot shrink below the width its columns need. The GST rate table
 * is eight columns and will not go under 715px, so on a phone it pushed the
 * page sideways — nothing above it scrolled or clipped, so the whole layout
 * moved with it.
 *
 * `.table-responsive` had been in the stylesheet all along and nothing used
 * it, because a table written in a FAQ has no way to opt in.
 */

const run = (tree: any) => {
  (rehypeTableScroll() as (t: any) => void)(tree);
  return tree;
};

const root = (children: any[]) => ({ type: 'root', children });
const el = (tagName: string, children: any[] = []) => ({ type: 'element', tagName, properties: {}, children });
const jsx = (name: string, children: any[] = []) => ({ type: 'mdxJsxFlowElement', name, attributes: [], children });

const className = (n: any) =>
  n.type === 'element'
    ? [n.properties?.className].flat().join(' ')
    : (n.attributes ?? []).find((a: any) => a.name === 'className')?.value ?? '';

describe('table scrollers', () => {
  it('wraps a Markdown pipe table', () => {
    const tree = run(root([el('table')]));
    expect(className(tree.children[0])).toContain('table-responsive');
    expect(tree.children[0].children[0].tagName).toBe('table');
  });

  it('wraps a table typed as HTML inside MDX', () => {
    // Both tables on this site are this kind. MDX parses raw HTML as JSX, so
    // it never arrives as a hast element — matching only `element`, the
    // obvious thing to write, silently does nothing at all.
    const tree = run(root([jsx('table')]));
    expect(className(tree.children[0])).toContain('table-responsive');
    expect(tree.children[0].children[0].name).toBe('table');
  });

  it('keeps the wrapper the same flavour as the table, so MDX can compile it', () => {
    expect(run(root([jsx('table')])).children[0].type).toBe('mdxJsxFlowElement');
    expect(run(root([el('table')])).children[0].type).toBe('element');
  });

  it('reaches a table nested inside other content', () => {
    const tree = run(root([el('div', [el('figure', [el('table')])])]));
    const figure = tree.children[0].children[0];
    expect(className(figure.children[0])).toContain('table-responsive');
  });

  it('does not wrap a table twice', () => {
    const once = run(root([el('table')]));
    const twice = run(once);
    expect(className(twice.children[0])).toContain('table-responsive');
    expect(className(twice.children[0].children[0])).not.toContain('table-responsive');
  });

  it('leaves everything else alone', () => {
    const tree = run(root([el('p'), el('img'), jsx('Chart')]));
    expect(tree.children.map((c: any) => c.tagName ?? c.name)).toEqual(['p', 'img', 'Chart']);
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

describe('the stylesheet still backs the wrapper', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

  it('.table-responsive scrolls horizontally', () => {
    const block = css.slice(css.indexOf('.table-responsive'));
    expect(block.slice(0, 160)).toMatch(/overflow-x:\s*auto/);
  });
});

describe('the census fits the screen it is pinned to', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/home.css'), 'utf8');
  // The pinned census, not the in-flow contents page of the same name: anchor
  // on the rule that only exists in the desktop grid.
  const start = css.indexOf('grid-column: spine');
  const block = css.slice(start, css.indexOf('}', css.indexOf('overscroll-behavior', start)));

  it('scrolls rather than clipping', () => {
    // It was capped at the viewport height with overflow: hidden, so on a
    // short laptop the last themes and the totals were cut off with no way
    // to reach them.
    expect(block).toMatch(/overflow-y:\s*auto/);
    expect(block).not.toMatch(/overflow:\s*hidden/);
  });

  it('is still capped, or it would run off the bottom', () => {
    expect(block).toMatch(/max-height:\s*calc\(100dvh/);
  });
});
