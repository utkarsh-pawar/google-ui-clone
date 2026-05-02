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
    { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, 'Accept-Version': 'v1' }, signal: AbortSignal.timeout(12000) }
  );
  if (!apiRes.ok) throw new Error(`Unsplash ${apiRes.status}`);
  const [photo] = await apiRes.json();
  if (!photo?.urls?.raw) throw new Error('No Unsplash photo');
  const imgRes = await fetch(`${photo.urls.raw}&w=${width}&h=${height}&fit=crop&crop=entropy&auto=format&q=85`, { signal: AbortSignal.timeout(15000) });
  if (!imgRes.ok) throw new Error(`Unsplash CDN ${imgRes.status}`);
  return { buffer: await imgRes.arrayBuffer(), credit: `${photo.user.name} on Unsplash` };
}

async function fetchPexels(prompt, width, height) {
  const orientation = height > width ? 'portrait' : 'landscape';
  const query = toSearchQuery(prompt);
  const apiRes = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=${orientation}`,
    { headers: { Authorization: PEXELS_KEY }, signal: AbortSignal.timeout(12000) }
  );
  if (!apiRes.ok) throw new Error(`Pexels ${apiRes.status}`);
  const data = await apiRes.json();
  if (!data.photos?.length) throw new Error('No Pexels photos');
  const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
  const src = (height > width ? photo.src.portrait : photo.src.landscape) || photo.src.large2x;
  const imgRes = await fetch(src, { signal: AbortSignal.timeout(15000) });
  if (!imgRes.ok) throw new Error(`Pexels CDN ${imgRes.status}`);
  return { buffer: await imgRes.arrayBuffer(), credit: `${photo.photographer} on Pexels` };
}

async function fetchPixabay(prompt, width, height) {
  const orientation = height > width ? 'vertical' : 'horizontal';
  const query = toSearchQuery(prompt);
  const apiRes = await fetch(
    `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=${orientation}&per_page=20&safesearch=true`,
    { signal: AbortSignal.timeout(12000) }
  );
  if (!apiRes.ok) throw new Error(`Pixabay ${apiRes.status}`);
  const data = await apiRes.json();
  if (!data.hits?.length) throw new Error('No Pixabay photos');
  const photo = data.hits[Math.floor(Math.random() * data.hits.length)];
  const imgRes = await fetch(photo.largeImageURL || photo.webformatURL, { signal: AbortSignal.timeout(15000) });
  if (!imgRes.ok) throw new Error(`Pixabay CDN ${imgRes.status}`);
  return { buffer: await imgRes.arrayBuffer(), credit: `${photo.user} on Pixabay` };
}

// Fast, free, no API key — real photos from Unsplash CDN via Picsum
async function fetchPicsum(prompt, width, height, idx) {
  const seed = Math.abs(idx * 97 + prompt.charCodeAt(0) * 13) % 1000;
  const res = await fetch(`https://picsum.photos/seed/${seed}/${width}/${height}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Picsum ${res.status}`);
  return { buffer: await res.arrayBuffer(), credit: 'Lorem Picsum' };
}

async function fetchPollinations(prompt, width, height) {
  const seed = Math.floor(Math.random() * 99999);
  const res = await fetch(
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`,
    { signal: AbortSignal.timeout(45000) }
  );
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  return { buffer: await res.arrayBuffer(), credit: null };
}

// SVG placeholder — never fails, used as last resort
function makePlaceholder(width, height, idx) {
  const colors = ['#1a1a2e','#16213e','#0f3460','#1b1b2f'];
  const bg = colors[idx % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6366f1" font-size="${Math.round(width * 0.04)}" font-family="sans-serif" opacity="0.6">Scene ${idx + 1}</text>
  </svg>`;
  return Buffer.from(svg);
}

function getSources(idx) {
  const pool = [];
  if (UNSPLASH_KEY) pool.push((p, w, h) => fetchUnsplash(p, w, h));
  if (PEXELS_KEY)   pool.push((p, w, h) => fetchPexels(p, w, h));
  if (PIXABAY_KEY)  pool.push((p, w, h) => fetchPixabay(p, w, h));

  const rotated = pool.length
    ? [...pool.slice(idx % pool.length), ...pool.slice(0, idx % pool.length)]
    : [];

  return [
    ...rotated,
    (p, w, h) => fetchPicsum(p, w, h, idx),  // fast free fallback
    (p, w, h) => fetchPollinations(p, w, h),  // slow AI fallback
  ];
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
      // try next source
    }
  }

  // Absolute last resort: SVG placeholder — never returns 502
  const placeholder = makePlaceholder(width, height, idx);
  return new Response(placeholder, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' } });
}
