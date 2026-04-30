export const maxDuration = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get('prompt') || '';
  const width  = parseInt(searchParams.get('width')  || '1280', 10);
  const height = parseInt(searchParams.get('height') || '720',  10);

  if (!prompt) return new Response('Missing prompt', { status: 400 });

  const seed = Math.floor(Math.random() * 99999);
  const upstream = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;

  try {
    const res = await fetch(upstream, {
      signal: AbortSignal.timeout(55000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VideoCreator/1.0)' },
    });

    if (!res.ok) return new Response(`Upstream ${res.status}`, { status: 502 });

    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    return new Response(err.message || 'Proxy fetch failed', { status: 502 });
  }
}
