/**
 * Resolves the default site origin used by handlers when the caller
 * doesn't pass an explicit `siteUrl`. Honors the `LIGHTHOUSE_BASE_URL`
 * env var (used by fetch.ts for domain validation) so all handlers
 * agree on the canonical origin.
 */
const DEFAULT = 'https://liberty-lighthouse.vercel.app';

export function getDefaultSite(): string {
  return (process.env.LIGHTHOUSE_BASE_URL ?? DEFAULT).replace(/\/$/, '');
}
