import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const CRAWLER_MAP: Record<string, string> = {
  gptBot: 'GPTBot',
  claudeBot: 'ClaudeBot',
  googleExtended: 'Google-Extended',
  ccBot: 'CCBot',
  oaiSearchBot: 'OAI-SearchBot',
  claudeSearchBot: 'Claude-SearchBot',
  chatgptUser: 'ChatGPT-User',
  claudeUser: 'Claude-User',
  perplexityBot: 'PerplexityBot',
  applebotExtended: 'Applebot-Extended',
};

export const GET: APIRoute = async ({ site }) => {
  const settings = await getCollection('settings');
  const entry = settings.find((s) => s.id === 'crawlers');
  const data = (entry?.data ?? {}) as Record<string, string>;

  const lines: string[] = [
    '# robots.txt — Generated from CMS settings',
    '# Manage these settings at /admin/#/collections/settings/entries/crawlers',
    '',
    'User-agent: *',
    'Allow: /',
    '',
  ];

  // Add Disallow rules for blocked crawlers (per CMS settings).
  for (const [key, userAgent] of Object.entries(CRAWLER_MAP)) {
    if (data[key] === 'block') {
      lines.push(`User-agent: ${userAgent}`);
      lines.push('Disallow: /');
      lines.push('');
    }
  }

  // Federated external content (/external/) is mirrored from third-party
  // sources for agent ingestion. Block conventional search engines from
  // indexing these URLs to avoid SEO duplication with the original sources;
  // AI crawlers remain allowed because that is the point of mirroring.
  const SEARCH_ENGINE_BOTS = [
    'Googlebot',
    'Googlebot-Image',
    'Googlebot-News',
    'Bingbot',
    'Slurp',
    'DuckDuckBot',
    'Baiduspider',
    'YandexBot',
    'Applebot',
  ];
  for (const ua of SEARCH_ENGINE_BOTS) {
    lines.push(`User-agent: ${ua}`);
    lines.push('Disallow: /external/');
    lines.push('');
  }

  lines.push(`Sitemap: ${new URL('/sitemap-index.xml', site).href}`);
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
