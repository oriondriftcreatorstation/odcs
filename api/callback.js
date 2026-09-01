module.exports = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');

  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
  const FRONTEND_URL = process.env.FRONTEND_URL; // This is your Vercel URL now

  // 1. Exchange code for token
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return res.status(500).send('Token exchange failed');
  }

  // 2. Get user info
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = await userRes.json();

  // 3. Redirect back to your main page on Vercel
  const redirectUrl = `${FRONTEND_URL}/upload.html?username=${encodeURIComponent(user.username)}&id=${user.id}&avatar=${user.avatar || ''}`;
  res.redirect(302, redirectUrl);
};
