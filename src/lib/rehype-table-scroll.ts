import type { Root, Element, Parent } from 'hast';
import { visit } from 'unist-util-visit';

/**
 * Wrap every table in a horizontal scroller.
 *
 * A table cannot shrink below the width its columns need. The GST rate table
 * is eight columns and will not go under 715px, so on a phone it pushed the
 * page sideways — nothing above it scrolled or clipped, so the whole layout
 * moved with it. `.table-responsive` already existed in the stylesheet for
 * exactly this, but a table written in a FAQ has no way to opt into it.
 *
 * Doing it here means it applies to every table CCS writes, without anyone
 * remembering to.
 *
 * Both node types are handled. A Markdown pipe table becomes a hast `element`;
 * a table typed as HTML inside an .mdx file is parsed as JSX and arrives as an
 * `mdxJsxFlowElement` instead. The two tables on this site are the second kind,
 * so matching only `element` — the obvious thing — silently does nothing.
 *
 * tabindex makes the scroller reachable by keyboard: a scrollable region that
 * cannot be focused is one a keyboard user cannot scroll. The role and label
 * keep that focus stop meaningful to a screen reader rather than an unnamed
 * stop on the way past.
 */

const LABEL = 'Table, scrollable horizontally';

type AnyNode = { type: string; tagName?: string; name?: string; [k: string]: unknown };

const isTable = (n: AnyNode) =>
  (n.type === 'element' && n.tagName === 'table') ||
  (n.type === 'mdxJsxFlowElement' && n.name === 'table');

const isWrapper = (n: AnyNode | undefined) => {
  if (!n) return false;
  if (n.type === 'element') {
    const c = (n as unknown as Element).properties?.className;
    return String(Array.isArray(c) ? c.join(' ') : c ?? '').includes('table-responsive');
  }
  if (n.type === 'mdxJsxFlowElement') {
    const attrs = (n.attributes ?? []) as Array<{ name?: string; value?: unknown }>;
    return attrs.some((a) => a.name === 'className' && String(a.value ?? '').includes('table-responsive'));
  }
  return false;
};

/** A wrapper of the same flavour as the table it wraps, so MDX can compile it. */
function wrap(table: AnyNode): AnyNode {
  if (table.type === 'mdxJsxFlowElement') {
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

export default function rehypeTableScroll() {
  return (tree: Root) => {
    visit(tree, (node: unknown, index: number | undefined, parent: Parent | undefined) => {
      const n = node as AnyNode;
      if (!isTable(n) || !parent || index === undefined) return;
      if (isWrapper(parent as unknown as AnyNode)) return;
      (parent.children as unknown[])[index] = wrap(n);
    });
  };
}
