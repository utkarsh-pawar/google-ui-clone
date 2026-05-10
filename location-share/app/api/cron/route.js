// Vercel Cron — runs 3× daily.
// Calls the Channel Manager (Groq/AI brain) to decide today's spiritual content,
// generates the script, and pushes to the render queue.
// The browser scheduler picks up queued jobs and renders + uploads.

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    // Channel Manager decides today's topic and generates the script
    const res = await fetch(`${appUrl}/api/channel-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: 'chants',
        autoQueue: true,
        recentTopics: [], // TODO: pull from DB/KV store to avoid repeats
      }),
      signal: AbortSignal.timeout(55000),
    });

    const data = await res.json();
    return Response.json({
      ok: data.ok,
      deity:  data.decision?.deity,
      topic:  data.decision?.topic,
      title:  data.youtubeTitle,
      firedAt: new Date().toISOString(),
      error:  data.error || null,
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
