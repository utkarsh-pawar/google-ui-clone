export const maxDuration = 30;

const PEXELS_KEY  = process.env.PEXELS_API_KEY;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

const STOP_WORDS = new Set(['the','a','an','and','or','in','on','at','to','for','of','with','is','are','was','that','this','it','from','as']);

function toQuery(prompt) {
  return prompt.replace(/[^\w\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 4).join(' ') || 'nature';
}

async function searchPexels(query, orientation) {
  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=10&orientation=${orientation}`,
    { headers: { Authorization: PEXELS_KEY }, signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const data = await res.json();
  if (!data.videos?.length) throw new Error('No Pexels videos');
  const video = data.videos[Math.floor(Math.random() * Math.min(5, data.videos.length))];
  // Prefer HD (720p) for balance of quality and size
  const file = video.video_files
    .filter(f => f.width <= 1280 && f.height <= 1280)
    .sort((a, b) => b.width - a.width)[0];
  if (!file) throw new Error('No suitable Pexels file');
  return { url: file.link, width: file.width, height: file.height, source: 'pexels' };
}

async function searchPixabay(query, orientation) {
  const res = await fetch(
    `https://pixabay.com/api/videos/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&orientation=${orientation}&per_page=10`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (res.status === 429) throw Object.assign(new Error('Pixabay rate limit'), { status: 429 });
  if (!res.ok) throw new Error(`Pixabay ${res.status}`);
  const data = await res.json();
  if (!data.hits?.length) throw new Error('No Pixabay videos');
  const hit = data.hits[Math.floor(Math.random() * Math.min(5, data.hits.length))];
  const file = hit.videos.medium || hit.videos.small;
  if (!file?.url) throw new Error('No Pixabay file');
  return { url: file.url, width: file.width, height: file.height, source: 'pixabay' };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const prompt      = searchParams.get('prompt') || '';
  const orientation = searchParams.get('orientation') === 'portrait' ? 'portrait' : 'landscape';

  if (!prompt) return Response.json({ error: 'Missing prompt' }, { status: 400 });
  if (!PEXELS_KEY && !PIXABAY_KEY) return Response.json({ error: 'No video API keys' }, { status: 503 });

  const query = toQuery(prompt);

  if (PEXELS_KEY) {
    try { return Response.json(await searchPexels(query, orientation)); }
    catch {}
  }
  if (PIXABAY_KEY) {
    try {
      const pxOrientation = orientation === 'portrait' ? 'vertical' : 'horizontal';
      return Response.json(await searchPixabay(query, pxOrientation));
    } catch (e) {
      if (e.status === 429) return Response.json({ error: 'rate_limit' }, { status: 429 });
    }
  }

  return Response.json({ error: 'No video found' }, { status: 404 });
}
