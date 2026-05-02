export async function GET(request) {
  const { searchParams, protocol, host } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return new Response(`<html><body><h2>❌ Auth failed: ${error}</h2><a href="/video-creator/scheduler">Back</a></body></html>`,
      { headers: { 'Content-Type': 'text/html' } });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}//${host}`;
  const redirectUri = `${appUrl}/api/youtube/callback`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.YOUTUBE_CLIENT_ID || '',
      client_secret: process.env.YOUTUBE_CLIENT_SECRET || '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return new Response(`<html><body><h2>❌ Token error: ${data.error_description}</h2></body></html>`,
      { headers: { 'Content-Type': 'text/html' } });
  }

  const html = `<!DOCTYPE html>
<html>
<head><title>Connected!</title>
<style>body{font-family:sans-serif;background:#0a1628;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px}</style>
</head>
<body>
<div style="font-size:48px">✅</div>
<h2>YouTube Channel Connected!</h2>
<p style="color:#94a3b8">Redirecting to scheduler…</p>
<script>
  const exp = Date.now() + ${data.expires_in || 3600} * 1000;
  localStorage.setItem('yt_access_token', ${JSON.stringify(data.access_token)});
  localStorage.setItem('yt_token_expiry', exp);
  ${data.refresh_token ? `localStorage.setItem('yt_refresh_token', ${JSON.stringify(data.refresh_token)});` : ''}
  setTimeout(() => { window.location = '/video-creator/scheduler'; }, 1500);
</script>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
