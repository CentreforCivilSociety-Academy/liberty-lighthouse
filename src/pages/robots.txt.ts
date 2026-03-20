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

  // Add Disallow rules for blocked crawlers
  for (const [key, userAgent] of Object.entries(CRAWLER_MAP)) {
    if (data[key] === 'block') {
      lines.push(`User-agent: ${userAgent}`);
      lines.push('Disallow: /');
      lines.push('');
    }
  }

  lines.push(`Sitemap: ${new URL('/sitemap-index.xml', site).href}`);
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
