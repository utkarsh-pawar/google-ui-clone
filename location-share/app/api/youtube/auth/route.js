export async function GET(request) {
  const { searchParams, protocol, host } = new URL(request.url);
  const channelId = searchParams.get('channelId') || 'general';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}//${host}`;
  const redirectUri = `${appUrl}/api/youtube/callback`;

  const params = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state: channelId,
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
