import type { Root, Element, Parent } from 'hast';
import { visit } from 'unist-util-visit';

/**
 * Make any table survive any screen, whatever shape it arrives in.
 *
 * A table cannot shrink below the width its columns need. The GST rate table
 * is eight columns and will not go under 715px, so in a phone-width column it
 * spills nearly 400px past the text, and nothing above it scrolls or clips, so
 * the whole page moves sideways with it.
 *
 * Nobody writing a FAQ should have to know that. This runs on every render
 * path, so a table works whether it was typed as Markdown pipes, written as
 * HTML, or pasted out of Word or Google Docs.
 *
 * Two things happen to every table:
 *
 * 1. It gets a scroller. `.table-responsive` was already in the stylesheet
 *    and nothing used it, because content has no way to opt into a class.
 *
 * 2. Its presentational sizing is stripped. A table pasted from a word
 *    processor carries width="720" and inline pixel widths from whatever
 *    column layout it had there. Inside a scroller that would still work, but
 *    it forces the table to stay 720px wide on a phone when its text might
 *    have fitted in 300. Dropping those lets it size to its own content.
 *
 * Node types: a Markdown pipe table arrives as a hast element, while a table
 * typed as HTML inside .mdx is parsed as JSX and arrives as an
 * mdxJsxFlowElement. Both tables on this site are the second kind, so matching
 * only `element` — the obvious thing — compiles cleanly and does nothing.
 */

const LABEL = 'Table, scrollable horizontally';

/** Sizing and presentation the author's tool baked in. Not ours to keep. */
const DROP_ATTRS = new Set([
  'width', 'height', 'cellpadding', 'cellPadding', 'cellspacing', 'cellSpacing',
  'border', 'align', 'valign', 'vAlign', 'bgcolor', 'bgColor', 'frame', 'rules',
]);

/** Elements whose width would otherwise pin the table open. */
const SIZED = new Set(['table', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th']);

/** Fixed track sizes in an inline style. Percentages are fine — they flex. */
const FIXED_SIZE = /(?:^|;)\s*(?:min-|max-)?(?:width|height)\s*:\s*[^;]*?(?:px|pt|cm|mm|in|pc)\s*(?=;|$)/gi;

type AnyNode = {
  type: string;
  tagName?: string;
  name?: string;
  properties?: Record<string, unknown>;
  attributes?: Array<{ type?: string; name?: string; value?: unknown }>;
  children?: unknown[];
};

const isJsx = (n: AnyNode) => n.type === 'mdxJsxFlowElement' || n.type === 'mdxJsxTextElement';
const tagOf = (n: AnyNode) => (isJsx(n) ? n.name : n.type === 'element' ? n.tagName : undefined);
const isTable = (n: AnyNode) => tagOf(n) === 'table';

function cleanStyle(value: string): string | undefined {
  const kept = value.replace(FIXED_SIZE, '').replace(/^\s*;+|;+\s*$/g, '').trim();
  return kept || undefined;
}

/** Drop baked-in sizing from a table and everything inside it. */
function normalise(node: AnyNode): void {
  const tag = tagOf(node);
  if (tag && SIZED.has(tag)) {
    if (isJsx(node) && Array.isArray(node.attributes)) {
      node.attributes = node.attributes.flatMap((a) => {
        if (!a.name || DROP_ATTRS.has(a.name)) return a.name && DROP_ATTRS.has(a.name) ? [] : [a];
        if (a.name === 'style' && typeof a.value === 'string') {
          const style = cleanStyle(a.value);
          return style ? [{ ...a, value: style }] : [];
        }
        return [a];
      });
    } else if (node.properties) {
      for (const key of Object.keys(node.properties)) {
        if (DROP_ATTRS.has(key)) delete node.properties[key];
      }
      const style = node.properties.style;
      if (typeof style === 'string') {
        const kept = cleanStyle(style);
        if (kept) node.properties.style = kept;
        else delete node.properties.style;
      }
    }
  }
  for (const child of (node.children ?? []) as AnyNode[]) {
    if (child && typeof child === 'object' && 'type' in child) normalise(child);
  }
}

const hasWrapperClass = (v: unknown) =>
  String(Array.isArray(v) ? v.join(' ') : v ?? '').includes('table-responsive');

function isWrapper(n: AnyNode | undefined): boolean {
  if (!n) return false;
  if (isJsx(n)) {
    return (n.attributes ?? []).some((a) => a.name === 'className' && hasWrapperClass(a.value));
  }
  if (n.type === 'element') return hasWrapperClass(n.properties?.className);
  return false;
}

/** A wrapper of the same flavour as the table, or MDX cannot compile it. */
function wrap(table: AnyNode): AnyNode {
  if (isJsx(table)) {
    return {
      type: 'mdxJsxFlowElement',
      name: 'div',
      attributes: [
        { type: 'mdxJsxAttribute', name: 'className', value: 'table-responsive' },
        { type: 'mdxJsxAttribute', name: 'tabIndex', value: '0' },
        { type: 'mdxJsxAttribute', name: 'role', value: 'region' },
        { type: 'mdxJsxAttribute', name: 'aria-label', value: LABEL },
      ],
      children: [table],
    };
  }
  return {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['table-responsive'],
      tabIndex: 0,
      role: 'region',
      'aria-label': LABEL,
    },
    children: [table],
  };
}

export default function rehypeTableResponsive() {
  return (tree: Root) => {
    visit(tree, (node: unknown, index: number | undefined, parent: Parent | undefined) => {
      const n = node as AnyNode;
      if (!isTable(n) || !parent || index === undefined) return;
      normalise(n);
      if (isWrapper(parent as unknown as AnyNode)) return;
      (parent.children as unknown[])[index] = wrap(n);
    });
  };
}
