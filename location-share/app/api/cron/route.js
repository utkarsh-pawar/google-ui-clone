// Vercel Cron endpoint — called 3× daily (see vercel.json).
// Generates one script per configured channel and pushes to /api/queue.
// The browser scheduler picks up queued jobs and renders + uploads them.

export const maxDuration = 60;
export const runtime = 'nodejs';

import { getTopicsByChannelId } from '@/lib/financeTopics';

// Channels to auto-post for (add/remove as needed)
const AUTO_CHANNELS = [
  { channelId: 'general', style: 'comic',     format: 'portrait', language: 'en' },
  { channelId: 'comedy',  style: 'comic',     format: 'portrait', language: 'en' },
  { channelId: 'sports',  style: 'cinematic', format: 'portrait', language: 'en' },
];

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const results = [];

  for (const cfg of AUTO_CHANNELS) {
    try {
      // Pick today's topic for this channel
      const topics = getTopicsByChannelId(cfg.channelId);
      const slotIdx = Math.floor(Date.now() / (8 * 3600 * 1000)) % topics.length; // rotates every 8h
      const topic = topics[slotIdx];

      // Generate script
      const scriptRes = await fetch(`${appUrl}/api/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.topic,
          angle: topic.angle,
          genre: topic.genre || 'finance',
          format: cfg.format,
          language: cfg.language,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!scriptRes.ok) throw new Error(`Script API ${scriptRes.status}`);
      const script = await scriptRes.json();

      // Push to queue
      await fetch(`${appUrl}/api/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': secret || '',
        },
        body: JSON.stringify({
          channelId: cfg.channelId,
          style: cfg.style,
          format: cfg.format,
          language: cfg.language,
          topic: topic.topic,
          script: script.script,
          youtubeTitle: script.youtubeTitle || script.titleOptions?.[0] || topic.topic,
          youtubeDescription: script.description || '',
          youtubeTags: script.tags || [],
          titleText: script.suggestedTitle || '',
        }),
      });

      results.push({ channelId: cfg.channelId, ok: true, title: script.youtubeTitle });
    } catch (err) {
      results.push({ channelId: cfg.channelId, ok: false, error: err.message });
    }
  }

  return Response.json({ ok: true, results, firedAt: new Date().toISOString() });
}
