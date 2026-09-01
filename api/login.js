module.exports = (req, res) => {
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

  // Get the page the user was on (from the query parameter)
  const returnTo = req.query.return_to || '/upload.html';

  // Build the Discord OAuth URL with the return URL stored in the 'state' parameter
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify&state=${encodeURIComponent(returnTo)}`;

  res.redirect(302, url);
};
