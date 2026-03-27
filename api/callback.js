export default async function handler(req, res) {
  const { code } = req.query;
  const { OAUTH_GITHUB_CLIENT_ID, OAUTH_GITHUB_CLIENT_SECRET } = process.env;

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: OAUTH_GITHUB_CLIENT_ID,
        client_secret: OAUTH_GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data = await response.json();

    const postMsgHtml = `
<html><body><script>
(function() {
  function recieveMessage(e) {
    console.log("recieveMessage %o", e);
    window.opener.postMessage(
      'authorization:github:success:${JSON.stringify({ token: data.access_token, provider: "github" })}',
      e.origin
    );
    window.removeEventListener("message", recieveMessage, false);
  }
  window.addEventListener("message", recieveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script></body></html>`;

    res.status(200).send(postMsgHtml);
  } catch (err) {
    res.status(500).send(`<html><body><p>OAuth error: ${err.message}</p></body></html>`);
  }
}
