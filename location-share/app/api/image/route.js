export const maxDuration = 60;

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Extract meaningful search keywords from a scene prompt
function toUnsplashQuery(prompt) {
  const stop = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'is','are','was','were','be','been','have','has','had','do','does','did',
    'will','would','could','should','may','might','that','this','these','those',
    'it','its','from','by','as','so','if','then','when','where','how','what',
    'which','who','not','no','all','just','more','very','also','than','into',
  ]);
  return prompt
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w.toLowerCase()))
    .slice(0, 5)
    .join(' ');
}

async function fetchUnsplash(prompt, width, height) {
  const orientation = height > width ? 'portrait' : 'landscape';
  const query = toUnsplashQuery(prompt);

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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get('prompt') || '';
  const width  = parseInt(searchParams.get('width')  || '1280', 10);
  const height = parseInt(searchParams.get('height') || '720',  10);

  if (!prompt) return new Response('Missing prompt', { status: 400 });

  try {
    const { buffer, credit } = UNSPLASH_KEY
      ? await fetchUnsplash(prompt, width, height)
      : await fetchPollinations(prompt, width, height);

    const headers = {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    };
    if (credit) headers['X-Photo-Credit'] = credit;

    return new Response(buffer, { headers });
  } catch (err) {
    // If Unsplash fails, fall back to Pollinations
    if (UNSPLASH_KEY) {
      try {
        const { buffer } = await fetchPollinations(prompt, width, height);
        return new Response(buffer, {
          headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
        });
      } catch {}
    }
    return new Response(err.message || 'Image fetch failed', { status: 502 });
  }
}
