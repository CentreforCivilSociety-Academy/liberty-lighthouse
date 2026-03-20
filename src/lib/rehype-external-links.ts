import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';

interface Options {
  siteHostname?: string;
}

/**
 * Rehype plugin that processes external links:
 * - Appends UTM parameters (utm_source, utm_medium)
 * - Adds target="_blank" and rel="noopener noreferrer"
 */
export default function rehypeExternalLinks(options: Options = {}) {
  const siteHostname = options.siteHostname || '';

  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return;

      const href = node.properties?.href;
      if (typeof href !== 'string') return;
      if (!href.startsWith('http://') && !href.startsWith('https://')) return;

      // Skip internal links
      try {
        const url = new URL(href);
        if (siteHostname && url.hostname === siteHostname) return;
      } catch {
        return;
      }

      // Append UTM params
      try {
        const url = new URL(href);
        if (!url.searchParams.has('utm_source')) {
          url.searchParams.set('utm_source', siteHostname || 'libertylighthouse');
          url.searchParams.set('utm_medium', 'website');
          node.properties!.href = url.toString();
        }
      } catch {
        // Leave href unchanged if URL parsing fails
      }

      // Add target and rel for security
      node.properties!.target = '_blank';
      node.properties!.rel = 'noopener noreferrer';
    });
  };
}
