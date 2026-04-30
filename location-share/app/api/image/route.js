export const maxDuration = 60;

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS_KEY   = process.env.PEXELS_API_KEY;
const PIXABAY_KEY  = process.env.PIXABAY_API_KEY;

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
    .join(' ') || 'nature';
}

async function fetchUnsplash(prompt, width, height) {
  const orientation = height > width ? 'portrait' : 'landscape';
  const query = toSearchQuery(prompt);
  const apiRes = await fetch(
    `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=${orientation}&count=1`,
    { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, 'Accept-Version': 'v1' }, signal: AbortSignal.timeout(15000) }
  );
  if (!apiRes.ok) throw new Error(`Unsplash ${apiRes.status}`);
  const [photo] = await apiRes.json();
  if (!photo?.urls?.raw) throw new Error('No Unsplash photo');
  const imgRes = await fetch(`${photo.urls.raw}&w=${width}&h=${height}&fit=crop&crop=entropy&auto=format&q=85`, { signal: AbortSignal.timeout(20000) });
  if (!imgRes.ok) throw new Error(`Unsplash CDN ${imgRes.status}`);
  return { buffer: await imgRes.arrayBuffer(), credit: `${photo.user.name} on Unsplash` };
}

async function fetchPexels(prompt, width, height) {
  const orientation = height > width ? 'portrait' : 'landscape';
  const query = toSearchQuery(prompt);
  const apiRes = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=${orientation}`,
    { headers: { Authorization: PEXELS_KEY }, signal: AbortSignal.timeout(15000) }
  );
  if (!apiRes.ok) throw new Error(`Pexels ${apiRes.status}`);
  const data = await apiRes.json();
  if (!data.photos?.length) throw new Error('No Pexels photos');
  const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
  const src = (height > width ? photo.src.portrait : photo.src.landscape) || photo.src.large2x;
  const imgRes = await fetch(src, { signal: AbortSignal.timeout(20000) });
  if (!imgRes.ok) throw new Error(`Pexels CDN ${imgRes.status}`);
  return { buffer: await imgRes.arrayBuffer(), credit: `${photo.photographer} on Pexels` };
}

async function fetchPixabay(prompt, width, height) {
  const orientation = height > width ? 'vertical' : 'horizontal';
  const query = toSearchQuery(prompt);
  const apiRes = await fetch(
    `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=${orientation}&per_page=20&safesearch=true`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!apiRes.ok) throw new Error(`Pixabay ${apiRes.status}`);
  const data = await apiRes.json();
  if (!data.hits?.length) throw new Error('No Pixabay photos');
  const photo = data.hits[Math.floor(Math.random() * data.hits.length)];
  const src = photo.largeImageURL || photo.webformatURL;
  const imgRes = await fetch(src, { signal: AbortSignal.timeout(20000) });
  if (!imgRes.ok) throw new Error(`Pixabay CDN ${imgRes.status}`);
  return { buffer: await imgRes.arrayBuffer(), credit: `${photo.user} on Pixabay` };
}

async function fetchPollinations(prompt, width, height) {
  const seed = Math.floor(Math.random() * 99999);
  const res = await fetch(
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`,
    { signal: AbortSignal.timeout(55000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VideoCreator/1.0)' } }
  );
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  return { buffer: await res.arrayBuffer(), credit: null };
}

// Build a round-robin list from available sources, Pollinations always last resort
function getSources(idx) {
  const pool = [];
  if (UNSPLASH_KEY) pool.push(fetchUnsplash);
  if (PEXELS_KEY)   pool.push(fetchPexels);
  if (PIXABAY_KEY)  pool.push(fetchPixabay);

  if (pool.length === 0) return [fetchPollinations];

  // Rotate starting position by idx so each scene hits a different primary source
  const rotated = [...pool.slice(idx % pool.length), ...pool.slice(0, idx % pool.length)];
  return [...rotated, fetchPollinations];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get('prompt') || '';
  const width  = parseInt(searchParams.get('width')  || '1280', 10);
  const height = parseInt(searchParams.get('height') || '720',  10);
  const idx    = parseInt(searchParams.get('idx')    || '0',    10);

  if (!prompt) return new Response('Missing prompt', { status: 400 });

  for (const source of getSources(idx)) {
    try {
      const { buffer, credit } = await source(prompt, width, height);
      const headers = { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' };
      if (credit) headers['X-Photo-Credit'] = credit;
      return new Response(buffer, { headers });
    } catch {
      // silent — try next source
    }
  }

  return new Response('All image sources failed', { status: 502 });
}
