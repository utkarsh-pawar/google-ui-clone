const VOICES = new Set([
  'Brian', 'Amy', 'Emma', 'Joanna', 'Joey', 'Justin', 'Kendra',
  'Kimberly', 'Matthew', 'Salli', 'Nicole', 'Russell', 'Geraint',
]);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const text = (searchParams.get('text') || '').slice(0, 500).trim();
  const voice = VOICES.has(searchParams.get('voice')) ? searchParams.get('voice') : 'Brian';

  if (!text) return new Response('Missing text', { status: 400 });

  const upstream = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(text)}`;

  try {
    const res = await fetch(upstream, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return new Response('TTS upstream error', { status: 502 });
    const audio = await res.arrayBuffer();
    return new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response('TTS fetch failed', { status: 502 });
  }
}
