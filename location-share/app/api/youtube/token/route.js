// Refreshes access token using stored refresh token
export async function POST(request) {
  const { refresh_token } = await request.json();
  const token = refresh_token || process.env.YOUTUBE_REFRESH_TOKEN;
  if (!token) return Response.json({ error: 'No refresh token' }, { status: 400 });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID || '',
      client_secret: process.env.YOUTUBE_CLIENT_SECRET || '',
      refresh_token: token,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: data.error_description }, { status: 400 });

  return Response.json({
    access_token: data.access_token,
    expires_in: data.expires_in,
    expiry: Date.now() + data.expires_in * 1000,
  });
}
