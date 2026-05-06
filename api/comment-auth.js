// OAuth initiator for the comment-form sign-in. Mirrors api/auth.js (which
// is used by Decap CMS admins) but requests a much smaller scope —
// public_repo only — so commenters aren't asked to grant full repo access.
//
// public_repo lets us call /user to verify identity. Comment commits don't
// happen through the commenter's token; they're routed via GitHub Issues
// (which any authenticated user can open on a public repo, no collaborator
// access needed) and then converted to repo files by a GitHub Action that
// runs with the auto-provided GITHUB_TOKEN.
export default function handler(req, res) {
  const { OAUTH_GITHUB_CLIENT_ID } = process.env;

  const authUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${OAUTH_GITHUB_CLIENT_ID}` +
    `&scope=public_repo`;

  res.redirect(authUrl);
}
