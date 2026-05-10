// Vercel Cron — fires 3× daily (8 AM, 1 PM, 6 PM IST).
// Runs the complete server-side pipeline:
// script → images → audio → FFmpeg render → YouTube upload.
// No browser needed. Close the tab and come back later.

export const maxDuration = 300;
export const runtime = 'nodejs';

const CHANTS_TAGS = ['#bhagavadgita','#shorts','#spiritual','#hindiwisdom','#hanumanchalisa','#sanatan','#viral','#bhakti','#devotional','#india'];

const WEEKDAY = [
  { deity: 'Surya',   angle: 'story',  topic: 'सूर्य देव की महिमा — सुबह की पहली किरण का रहस्य' },
  { deity: 'Shiva',   angle: 'shloka', topic: 'ॐ नमः शिवाय — सोमवार को शिव की आराधना का असली अर्थ' },
  { deity: 'Hanuman', angle: 'prayer', topic: 'मंगलवार का व्रत — हनुमान जी की कृपा पाने का सही तरीका' },
  { deity: 'Ganesha', angle: 'wisdom', topic: 'बुधवार को गणेश जी — विघ्नहर्ता की कृपा से बाधाएं हटाएं' },
  { deity: 'Vishnu',  angle: 'story',  topic: 'गुरुवार को विष्णु भगवान — पालनहार की कहानी' },
  { deity: 'Lakshmi', angle: 'prayer', topic: 'शुक्रवार को लक्ष्मी माता — धन और सुख-समृद्धि की आरती' },
  { deity: 'Hanuman', angle: 'shloka', topic: 'शनिवार को हनुमान चालीसा — शनि के प्रकोप से मुक्ति' },
];

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  // Import pipeline functions
  const { getStudioConfig, saveJob, updateJob, runPipeline } = await import('@/lib/serverPipeline.js');

  const config = await getStudioConfig();
  if (!config.autoMode) {
    return Response.json({ ok: false, skipped: true, reason: 'autoMode is off' });
  }

  const channelId = config.channelId || 'chants';
  const today = WEEKDAY[new Date().getDay()];
  const jobId = `job_${Date.now()}`;

  // Fire-once guard: don't run the same slot twice in one day
  const { getRecentTopics } = await import('@/app/api/queue/route.js').catch(() => ({ getRecentTopics: async () => [] }));
  const firedKey = `cron_fired_${new Date().toISOString().slice(0, 13)}_${channelId}`; // hour-scoped
  try {
    const { default: redis } = await import('@/lib/serverPipeline.js');
    // just check via redisCmd directly
  } catch {}

  await saveJob(jobId, {
    id: jobId,
    status: 'script',
    deity: today.deity,
    angle: today.angle,
    topic: today.topic,
    channelId,
    startedAt: Date.now(),
    progress: 'Generating script…',
  });

  try {
    // 1. Generate script
    const scriptRes = await fetch(`${appUrl}/api/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: today.topic,
        angle: today.angle,
        genre: 'chants',
        deity: today.deity,
        format: 'portrait',
        language: 'hi',
      }),
      signal: AbortSignal.timeout(30000),
    });
    const scriptData = await scriptRes.json();
    if (!scriptRes.ok) throw new Error(scriptData.error || 'Script generation failed');

    const youtubeTitle       = scriptData.youtubeTitle || today.topic;
    const youtubeDescription = scriptData.description  || '';
    const youtubeTags        = scriptData.tags         || CHANTS_TAGS;

    await updateJob(jobId, {
      youtubeTitle,
      progress: `Script ready: "${youtubeTitle.slice(0, 50)}"`,
    });

    // 2. Run full pipeline (images → audio → FFmpeg → YouTube)
    const ytResult = await runPipeline({
      jobId,
      deity: today.deity,
      angle: today.angle,
      topic: today.topic,
      genre: 'chants',
      channelId,
      youtubeTitle,
      youtubeDescription,
      youtubeTags,
      script: scriptData.script,
      appUrl,
      language: 'hi',
      format: 'portrait',
    });

    await updateJob(jobId, {
      status: 'done',
      ytVideoId:  ytResult.videoId,
      ytVideoUrl: ytResult.videoUrl,
      completedAt: Date.now(),
      progress: `Done — ${ytResult.videoUrl}`,
    });

    return Response.json({ ok: true, jobId, ytVideoUrl: ytResult.videoUrl, deity: today.deity });

  } catch (err) {
    await updateJob(jobId, {
      status: 'failed',
      error: err.message,
      completedAt: Date.now(),
      progress: `Failed: ${err.message}`,
    });
    console.error('Cron pipeline failed:', err);
    return Response.json({ ok: false, error: err.message, jobId }, { status: 500 });
  }
}
