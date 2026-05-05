# Comments system — deferred

**Status:** parked. Will be picked up after Vercel access is restored.
**Date parked:** 2026-05-05.

## Why this is parked

Implementing comments requires either:

1. Adding a new server-side credential (a fine-grained GitHub PAT) to Vercel env, or
2. Reusing the existing OAuth flow and forcing every commenter to authenticate with GitHub.

Path (1) is preferred (broader audience — anonymous commenters supported) but requires Vercel dashboard access to add the env var. Without that, the system can be designed and coded but cannot ship.

Path (2) ships without any Vercel changes but excludes the substantial fraction of CCS's audience that doesn't have a GitHub account (students, journalists, general readers). For a public-education project that's a meaningful loss.

Rather than commit to one path under uncertainty, the decision was to ship the rest of this branch (Phase 1 + Phase 2 + summaries + MCP) first and revisit comments cleanly later.

## Decided design — when picked back up

### Data model

Comments are a content collection at `src/content/comments/{page-id}/{timestamp}-{rand}.md`. Each is a markdown file with frontmatter:

```yaml
status: pending          # pending | approved | rejected
page_type: faq           # faq | video | glossary
page_id: agriculture/why-msp-distorts
parent_id: null          # for threading later
name: Sahil
email: redacted-after-moderation
submitted_at: 2026-05-05T10:15:22Z
ip_hash: sha256-of-ip    # for abuse, no raw IP committed
turnstile_passed: true
github_username: null    # populated only if path (2) is chosen
```

The body is the comment text. Plain text in v1, escaped on render. No markdown formatting in v1.

### Pages with comments

FAQs, videos, glossary terms only. Spontaneous Order posts excluded (agent-only, no public HTML page on this site). Topic landing pages, indexes, and the homepage excluded as aggregations.

### Submission flow

1. Visitor fills form. Cloudflare Turnstile widget validates client-side.
2. Form POSTs to `/api/comments/submit` (Vercel serverless).
3. Function: verifies Turnstile token server-side, validates honeypot field, rate-limits by IP hash (Vercel KV or Upstash, free tier).
4. Function commits the new MD file via the GitHub API directly to `main` with `status: pending`. Identity used for the commit depends on the chosen path:
   - Path (1): server-side bot PAT in Vercel env.
   - Path (2): commenter's own OAuth token (passed in the request header after they sign in via existing `/api/auth` flow).
5. Visitor sees: "Thanks — your comment is awaiting review."

### Moderation flow

1. Admin opens `/admin/` (existing Decap CMS, GitHub OAuth via existing `OAUTH_GITHUB_CLIENT_ID/SECRET`).
2. New "Comments" collection lists pending entries.
3. Admin sets status to `approved` or `rejected`. Decap commits to `main`. Vercel rebuilds. Approved comments appear (~30 sec).

### Display

`<Comments />` Astro component reads `src/content/comments/{page-id}/` at build time, filters to `status === 'approved'`, sorts by `submitted_at`, renders threaded by `parent_id`. Email is never shown publicly; only `name` and `body`. The component is HTML-only — comments do **not** appear in `.md` siblings, `/llms-full.txt`, or the MCP server. The agent corpus is the canonical content; comments are commentary on top.

### Spam protection

Four layers:

1. Cloudflare Turnstile on the form (free, frictionless, server-verified).
2. Honeypot field (invisible input bots fill).
3. Rate limit by IP hash in the submit handler (3 comments/hour per IP).
4. Pre-moderation (humans see every comment before it's public).

### Privacy implications

Comments are stored in the public repo as plain markdown — transparent and auditable. Email and IP hash are admin-only. Privacy page additions:

- Public comment data: `name`, `body` only.
- Admin-only data: `email`, `ip_hash`, `submitted_at`. Used for abuse and notifications.
- Deletion request → email contact@ccs.in. We delete the MD file from the repo (and rebase if needed for git history).

### What's deliberately out of scope (v1)

- Email notifications (admin checks the CMS instead).
- Threaded reply UI (frontmatter has `parent_id`; UI added later).
- Markdown formatting in comments.
- Comment edit/delete by commenter.
- Comment count badges on FAQ/video/glossary indexes.

### Required env vars (for path 1, when Vercel access returns)

```
GITHUB_BOT_TOKEN          # fine-grained PAT scoped to this repo, write
                          # access on src/content/comments/ only
TURNSTILE_SITE_KEY        # public site key from Cloudflare Turnstile
TURNSTILE_SECRET_KEY      # private secret from Turnstile
KV_REST_API_URL           # Vercel KV (free tier, 30 MB / 30k cmds/day)
KV_REST_API_TOKEN         # Vercel KV auth
```

Path 2 doesn't need any of these — it reuses `OAUTH_GITHUB_CLIENT_ID`/`OAUTH_GITHUB_CLIENT_SECRET` already in Vercel env.

### Implementation order when picked back up

1. Decide path (1) vs (2) based on audience priorities.
2. If (1): provision env vars (10 minutes in Vercel UI).
3. Add `comments` content collection schema to `src/content.config.ts`.
4. Implement `/api/comments/submit.ts` Vercel function.
5. Implement `<CommentForm />` Preact island.
6. Implement `<Comments />` server-rendered display component.
7. Wire into FAQ, video, glossary slug pages.
8. Add "Comments" collection to `public/admin/config.yml` for Decap.
9. Update privacy page (HTML + .md sibling).
10. Local test against dev server + dummy PAT (path 1) or live OAuth (path 2).
11. Push, deploy, smoke test in production.

Estimated effort: 1 day end-to-end on path 1, 1.5 days on path 2 (adds OAuth UX surface).
