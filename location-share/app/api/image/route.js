export const maxDuration = 60;

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS_KEY   = process.env.PEXELS_API_KEY;

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','have','has','had','do','does','did',
  'will','would','could','should','may','might','that','this','these','those',
  'it','its','from','by','as','so','if','then','when','where','how','what',
  'which','who','not','no','all','just','more','very','also','than','into',
]);

function toSearchQuery(prompt) {
  return prompt
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 5)
    .join(' ');
}

async function fetchUnsplash(prompt, width, height) {
  const orientation = height > width ? 'portrait' : 'landscape';
  const query = toSearchQuery(prompt);

  const apiRes = await fetch(
    `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=${orientation}&count=1`,
    {
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, 'Accept-Version': 'v1' },
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!apiRes.ok) throw new Error(`Unsplash API ${apiRes.status}`);
  const [photo] = await apiRes.json();
  if (!photo?.urls?.raw) throw new Error('No photo returned');

  const imageUrl = `${photo.urls.raw}&w=${width}&h=${height}&fit=crop&crop=entropy&auto=format&q=85`;
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
  if (!imgRes.ok) throw new Error(`Unsplash CDN ${imgRes.status}`);

  return { buffer: await imgRes.arrayBuffer(), credit: `${photo.user.name} on Unsplash` };
}

async function fetchPexels(prompt, width, height) {
  const orientation = height > width ? 'portrait' : 'landscape';
  const query = toSearchQuery(prompt);

  const apiRes = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=${orientation}&page=1`,
    {
      headers: { Authorization: PEXELS_KEY },
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!apiRes.ok) throw new Error(`Pexels API ${apiRes.status}`);
  const data = await apiRes.json();
  if (!data.photos?.length) throw new Error('No Pexels photos found');

  const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
  const src = height > width ? photo.src.portrait : photo.src.landscape;
  const imgRes = await fetch(src || photo.src.large2x, { signal: AbortSignal.timeout(20000) });
  if (!imgRes.ok) throw new Error(`Pexels CDN ${imgRes.status}`);

  return { buffer: await imgRes.arrayBuffer(), credit: `${photo.photographer} on Pexels` };
}

async function fetchPollinations(prompt, width, height) {
  const seed = Math.floor(Math.random() * 99999);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(55000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VideoCreator/1.0)' },
  });
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  return { buffer: await res.arrayBuffer(), credit: null };
}

// Priority order based on available keys
function getSources(idx) {
  const photo = [];
  if (UNSPLASH_KEY) photo.push(fetchUnsplash);
  if (PEXELS_KEY)   photo.push(fetchPexels);

  if (photo.length === 0) {
    // No photo keys — just use Pollinations
    return [fetchPollinations];
  }

  if (photo.length === 2) {
    // Alternate Unsplash / Pexels, Pollinations as last resort
    return [photo[idx % 2], photo[(idx + 1) % 2], fetchPollinations];
  }

  // Only one photo source — use it, Pollinations as fallback
  return [photo[0], fetchPollinations];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get('prompt') || '';
  const width  = parseInt(searchParams.get('width')  || '1280', 10);
  const height = parseInt(searchParams.get('height') || '720',  10);
  const idx    = parseInt(searchParams.get('idx')    || '0',    10);

  if (!prompt) return new Response('Missing prompt', { status: 400 });

  const sources = getSources(idx);

  for (const source of sources) {
    try {
      const { buffer, credit } = await source(prompt, width, height);
      const headers = { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' };
      if (credit) headers['X-Photo-Credit'] = credit;
      return new Response(buffer, { headers });
    } catch {
      // try next source
    }
  }

  return new Response('All image sources failed', { status: 502 });
}
