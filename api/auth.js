export default function handler(req, res) {
  const { OAUTH_GITHUB_CLIENT_ID } = process.env;

  const authUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${OAUTH_GITHUB_CLIENT_ID}` +
    `&scope=repo,user`;

  res.redirect(authUrl);
}
