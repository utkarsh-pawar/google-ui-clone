export const maxDuration = 60;

const COLAB_URL    = process.env.COLAB_IMAGE_URL;
const HF_TOKEN     = process.env.HF_TOKEN;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS_KEY   = process.env.PEXELS_API_KEY;
const PIXABAY_KEY  = process.env.PIXABAY_API_KEY;

// Portrait/landscape sizes that work well for each AI model
const AI_SIZE = {
  portrait:  { w: 768,  h: 1344 },  // 9:16 Shorts
  landscape: { w: 1344, h: 768  },  // 16:9 Video
};

function aiSize(width, height) {
  return height > width ? AI_SIZE.portrait : AI_SIZE.landscape;
}

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

// ── AI sources (images match scene descriptions) ─────────────────────────────

async function fetchColab(prompt, width, height) {
  if (!COLAB_URL) throw new Error('No Colab URL');
  const res = await fetch(`${COLAB_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, width, height, steps: 25 }),
    signal: AbortSignal.timeout(55000),
  });
  if (!res.ok) throw new Error(`Colab ${res.status}`);
  return { buffer: await res.arrayBuffer(), credit: null };
}

async function fetchHuggingFace(prompt, width, height) {
  if (!HF_TOKEN) throw new Error('No HF_TOKEN');
  const { w, h } = aiSize(width, height);
  const res = await fetch(
    'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'true',  // wait instead of 503 on cold start
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { width: w, height: h, num_inference_steps: 4 },
      }),
      signal: AbortSignal.timeout(60000),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HF ${res.status}: ${body.slice(0, 120)}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('image')) throw new Error(`HF non-image: ${ct}`);
  return { buffer: await res.arrayBuffer(), credit: null };
}

async function fetchPollinations(prompt, width, height) {
  const { w, h } = aiSize(width, height);
  const seed = Math.floor(Math.random() * 99999);
  const res = await fetch(
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}`,
    { signal: AbortSignal.timeout(45000) }
  );
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  return { buffer: await res.arrayBuffer(), credit: null };
}

// ── Stock fallbacks (only when all AI sources fail) ───────────────────────────

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

async function fetchPicsum(prompt, width, height, idx) {
  const seed = Math.abs(idx * 97 + prompt.charCodeAt(0) * 13) % 1000;
  const res = await fetch(`https://picsum.photos/seed/${seed}/${width}/${height}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Picsum ${res.status}`);
  return { buffer: await res.arrayBuffer(), credit: 'Lorem Picsum' };
}

function makePlaceholder(width, height, idx) {
  const colors = ['#1a1a2e','#16213e','#0f3460','#1b1b2f'];
  const bg = colors[idx % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6366f1" font-size="${Math.round(width * 0.04)}" font-family="sans-serif" opacity="0.6">Scene ${idx + 1}</text>
  </svg>`;
  return Buffer.from(svg);
}

// Priority: Colab → HF Flux → Pollinations → stock → Picsum → placeholder
function getSources(idx) {
  const stock = [];
  if (UNSPLASH_KEY) stock.push((p, w, h) => fetchUnsplash(p, w, h));
  if (PEXELS_KEY)   stock.push((p, w, h) => fetchPexels(p, w, h));
  if (PIXABAY_KEY)  stock.push((p, w, h) => fetchPixabay(p, w, h));
  const rotated = stock.length
    ? [...stock.slice(idx % stock.length), ...stock.slice(0, idx % stock.length)]
    : [];

  return [
    (p, w, h) => fetchColab(p, w, h),
    (p, w, h) => fetchHuggingFace(p, w, h),
    (p, w, h) => fetchPollinations(p, w, h),
    ...rotated,
    (p, w, h) => fetchPicsum(p, w, h, idx),
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
      // silent fallthrough to next source
    }
  }

  const placeholder = makePlaceholder(width, height, idx);
  return new Response(placeholder, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' } });
}
