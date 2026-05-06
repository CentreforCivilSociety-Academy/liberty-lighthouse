import type { APIRoute } from 'astro';
import matter from 'gray-matter';
import { abs, markdownResponse } from '../lib/markdown-export';

// Mirror of src/pages/privacy.astro. When the prose changes, update both.
export const GET: APIRoute = async () => {
  const updatedAt = '2026-04-26';

  const fm = {
    type: 'privacy',
    title: 'Privacy',
    canonical_url: abs('/privacy/'),
    markdown_url: abs('/privacy.md'),
    updated_at: updatedAt,
  };

  const body = `# Privacy

*Last updated: ${updatedAt}*

Liberty Lighthouse is a public-education site published by the [Centre for Civil Society](https://ccs.in). This page explains what we collect, why, and how to control it.

## Short version

- We use Google Analytics 4 to count visits and understand which articles get read.
- We do not run advertising. We do not sell or share data with advertisers.
- Analytics cookies only fire after you click **Accept** on the consent banner.
- If you decline, we do not set analytics cookies and Google Analytics is sent only cookieless pings (no client identifier).
- Your IP address is anonymised before it reaches Google's servers.
- You can change your choice anytime via the **Cookie settings** link in the footer.

## What Google Analytics collects (only with your consent)

- Anonymised IP address (the last octet is masked).
- A randomly generated client ID stored in a cookie, used to recognise return visits.
- Page URL, referrer, browser, device type, country.
- Session duration and engagement events (page views, scroll, outbound link clicks).

No name, email, account, or other personally identifying information is collected by Liberty Lighthouse. We do not link analytics data to any individual.

## Data retention

Analytics events are retained by Google for the standard GA4 default of 14 months. After that the underlying event data is deleted from Google's servers. Aggregated reports may be retained beyond that.

## Cookies we set

- \`_ga\`, \`_ga_<id>\` — Google Analytics 4. Set only after you accept. Persistent. Used to recognise return visits.
- \`ll-consent-v1\` — your cookie preference itself. Stored in \`localStorage\` on your device only. Never sent to a server.

We do not use any other tracking, advertising, or social-media cookies.

## Your rights under GDPR

If you are in the European Union, the United Kingdom, or any jurisdiction with comparable rules, you have the right to:

- Decline analytics, with no impact on access to the site.
- Withdraw consent at any time using the **Cookie settings** link in the footer.
- Request deletion of any data tied to your visits. Because we collect no identifiers tied to a person, the practical mechanism is to clear your cookies — which removes the GA client ID we have on you.

To raise a question, write to [contact@ccs.in](mailto:contact@ccs.in).

## Embedded content

Some pages embed YouTube videos via \`lite-youtube-embed\`. The YouTube embed loads only after you click play. Until you do, no request is made to YouTube and no YouTube cookies are set. Once you click play, YouTube's own privacy policy applies.

## Comments

FAQ, video, and glossary pages have a comments section at the bottom. To leave a comment you sign in with GitHub. We ask GitHub for the smallest permission scope that lets us post on your behalf — \`public_repo\` — which lets us file your comment as a GitHub Issue on this site's public repository. We never see your password.

What's stored when you submit a comment:

- Your GitHub username and the display name you chose (both shown publicly above your comment).
- Your comment text (shown publicly once approved).
- The submission timestamp and the page you commented on.
- The GitHub Issue number created at submission time. The issue itself is automatically closed but remains in the repository's issue history as an audit record.

What we do *not* store: your email, any tracking cookies, or any data shared with third parties. Your GitHub session token is held in your browser's \`sessionStorage\` only; it is cleared when you close the tab and is never sent anywhere except to \`github.com\` (during sign-in) and to \`liberty-lighthouse.vercel.app/api/comments/submit\` (during submission).

Comments are reviewed by the Centre for Civil Society team before they appear on the site. We may approve, hide, or delete a comment at our discretion — for example, comments containing abuse, harassment, doxxing, or spam are deleted entirely.

To request removal of one of your own comments, email [contact@ccs.in](mailto:contact@ccs.in) with the comment URL and we will delete the file from the repository. Note that the original submission may still appear in the GitHub repository's issue history; for severe cases we will also delete the corresponding issue.

## Hosting

The site is statically generated and hosted on Vercel. Vercel may collect standard server access logs (IP, user-agent, timestamp) for reliability and abuse prevention. These logs are retained for a limited window per Vercel's policies and are not used for marketing.

## Changes to this notice

If we change what we collect or how, we'll update the date at the top of this page. Material changes will trigger the consent banner again so you can re-decide.
`;

  return markdownResponse(matter.stringify(body, fm));
};
