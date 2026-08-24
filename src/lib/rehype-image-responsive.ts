import type { Root, Parent } from 'hast';
import { visit } from 'unist-util-visit';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Give every local image its real dimensions, and let it lazy-load.
 *
 * An <img> written in Markdown carries nothing but a src. The browser cannot
 * know how tall it will be until it arrives, so it reserves no room and the
 * text below jumps when it lands — worst on a phone on a slow connection,
 * which is most of this audience. The six education charts are 818 to 1458px
 * wide and every one of them shifted the page.
 *
 * Reading the file is the only honest way to get the ratio: CCS uploads
 * through the CMS and will not be typing width and height by hand, and a
 * guessed aspect reserves the wrong space, which is worse than none.
 *
 * Scaling itself is CSS's job — see the `img` rule in global.css. This adds
 * only what CSS cannot know.
 */

const cache = new Map<string, { width: number; height: number } | null>();

async function measure(src: string): Promise<{ width: number; height: number } | null> {
  if (cache.has(src)) return cache.get(src)!;
  let result: { width: number; height: number } | null = null;
  try {
    const { width, height } = await sharp(join(process.cwd(), 'public', src)).metadata();
    if (width && height) result = { width, height };
  } catch {
    // Missing or unreadable: leave the image exactly as the author wrote it.
    result = null;
  }
  cache.set(src, result);
  return result;
}

type AnyNode = {
  type: string;
  tagName?: string;
  name?: string;
  properties?: Record<string, unknown>;
  attributes?: Array<{ type?: string; name?: string; value?: unknown }>;
};

const isJsx = (n: AnyNode) => n.type === 'mdxJsxFlowElement' || n.type === 'mdxJsxTextElement';
const isImage = (n: AnyNode) =>
  (n.type === 'element' && n.tagName === 'img') || (isJsx(n) && n.name === 'img');

const getAttr = (n: AnyNode, name: string): unknown =>
  isJsx(n)
    ? (n.attributes ?? []).find((a) => a.name === name)?.value
    : n.properties?.[name];

function setAttr(n: AnyNode, name: string, value: string | number): void {
  if (isJsx(n)) {
    n.attributes = n.attributes ?? [];
    n.attributes.push({ type: 'mdxJsxAttribute', name, value: String(value) });
  } else {
    n.properties = n.properties ?? {};
    n.properties[name] = value;
  }
}

export default function rehypeImageResponsive() {
  return async (tree: Root) => {
    const images: AnyNode[] = [];
    visit(tree, (node: unknown, _i: number | undefined, _p: Parent | undefined) => {
      const n = node as AnyNode;
      if (isImage(n)) images.push(n);
    });

    await Promise.all(
      images.map(async (node) => {
        const src = getAttr(node, 'src');
        // Anything not served from this site: we cannot measure it, and it is
        // not ours to lazy-load either.
        if (typeof src !== 'string' || !src.startsWith('/')) return;

        // Never overwrite what the author set deliberately.
        if (getAttr(node, 'width') == null && getAttr(node, 'height') == null) {
          const size = await measure(src);
          if (size) {
            setAttr(node, 'width', size.width);
            setAttr(node, 'height', size.height);
          }
        }
        if (getAttr(node, 'loading') == null) setAttr(node, 'loading', 'lazy');
        if (getAttr(node, 'decoding') == null) setAttr(node, 'decoding', 'async');
      }),
    );
  };
}
