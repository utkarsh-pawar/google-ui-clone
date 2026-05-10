// Persistent job queue using Vercel KV.
// Falls back to in-memory if KV env vars are not set (local dev).

export const runtime = 'nodejs';

const KV_QUEUE_KEY  = 'spiritual:queue';
const KV_TOPICS_KEY = 'spiritual:recent_topics';

// ── KV helpers (graceful no-op when KV not configured) ───────────────────────

async function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const { kv } = await import('@vercel/kv');
    return kv;
  } catch {
    return null;
  }
}

// ── In-memory fallback (unreliable on Vercel serverless — use KV in prod) ────
const memQueue = [];

// ── Queue operations ──────────────────────────────────────────────────────────

async function pushJob(job) {
  const kv = await getKV();
  if (kv) {
    await kv.lpush(KV_QUEUE_KEY, JSON.stringify(job));
    if (job.topic) {
      await kv.lpush(KV_TOPICS_KEY, job.topic);
      await kv.ltrim(KV_TOPICS_KEY, 0, 29); // keep last 30 topics
    }
  } else {
    memQueue.push(job);
  }
}

async function drainJobs() {
  const kv = await getKV();
  if (kv) {
    const raw = await kv.lrange(KV_QUEUE_KEY, 0, -1);
    if (raw.length) await kv.del(KV_QUEUE_KEY);
    return raw.map(j => (typeof j === 'string' ? JSON.parse(j) : j)).reverse();
  }
  return memQueue.splice(0);
}

export async function getRecentTopics() {
  const kv = await getKV();
  if (!kv) return [];
  const topics = await kv.lrange(KV_TOPICS_KEY, 0, 29);
  return topics.map(t => (typeof t === 'string' ? t : String(t)));
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET() {
  const jobs   = await drainJobs();
  const source = process.env.KV_REST_API_URL ? 'kv' : 'memory';
  return Response.json({ jobs, source });
}

export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('x-cron-secret') !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const job    = await request.json();
  await pushJob({ ...job, queuedAt: new Date().toISOString() });
  const source = process.env.KV_REST_API_URL ? 'kv' : 'memory';
  return Response.json({ ok: true, source });
}
