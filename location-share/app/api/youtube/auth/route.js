export async function GET(request) {
  const base = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${base.protocol}//${base.host}`;
  const redirectUri = `${appUrl}/api/youtube/callback`;

  const params = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent',
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
