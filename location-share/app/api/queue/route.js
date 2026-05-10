// Persistent job queue using Upstash Redis REST API directly (no package needed).
// Supports both Upstash env vars and legacy Vercel KV env vars.
// Falls back to in-memory when neither is set (local dev / first deploy).
//
// Setup (free): upstash.com → Create Database → copy REST URL + token
// Add to Vercel env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

export const runtime = 'nodejs';

const QUEUE_KEY  = 'spiritual:queue';
const TOPICS_KEY = 'spiritual:recent_topics';

// ── Upstash REST helper ───────────────────────────────────────────────────────

function getRedisConfig() {
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function redisCmd(...args) {
  const cfg = getRedisConfig();
  if (!cfg) return null;
  const res = await fetch(`${cfg.url}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
  });
  if (!res.ok) return null;
  const { result } = await res.json();
  return result;
}

// ── In-memory fallback ────────────────────────────────────────────────────────
const memQueue = [];

// ── Queue operations ──────────────────────────────────────────────────────────

async function pushJob(job) {
  const cfg = getRedisConfig();
  if (cfg) {
    await redisCmd('LPUSH', QUEUE_KEY, JSON.stringify(job));
    if (job.topic) {
      await redisCmd('LPUSH', TOPICS_KEY, job.topic);
      await redisCmd('LTRIM', TOPICS_KEY, '0', '29');
    }
  } else {
    memQueue.push(job);
  }
}

async function drainJobs() {
  const cfg = getRedisConfig();
  if (cfg) {
    const raw = await redisCmd('LRANGE', QUEUE_KEY, '0', '-1');
    if (Array.isArray(raw) && raw.length) {
      await redisCmd('DEL', QUEUE_KEY);
      return raw.map(j => {
        try { return typeof j === 'string' ? JSON.parse(j) : j; } catch { return null; }
      }).filter(Boolean).reverse();
    }
    return [];
  }
  return memQueue.splice(0);
}

export async function getRecentTopics() {
  const cfg = getRedisConfig();
  if (!cfg) return [];
  const topics = await redisCmd('LRANGE', TOPICS_KEY, '0', '29');
  return Array.isArray(topics) ? topics.map(String) : [];
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET() {
  const jobs   = await drainJobs();
  const source = getRedisConfig() ? 'redis' : 'memory';
  return Response.json({ jobs, source });
}

export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('x-cron-secret') !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const job    = await request.json();
  await pushJob({ ...job, queuedAt: new Date().toISOString() });
  const source = getRedisConfig() ? 'redis' : 'memory';
  return Response.json({ ok: true, source });
}
