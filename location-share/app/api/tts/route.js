export const maxDuration = 30;

// Google Translate TTS — unofficial but no API key needed, works from server
async function fetchGoogleTTS(text, lang = 'en') {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&total=1&idx=0&textlen=${text.length}&client=tw-ob&prev=input&ttsspeed=0.9`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://translate.google.com/',
      'Accept': 'audio/mpeg,audio/*',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Google TTS ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 1000) throw new Error('Google TTS returned empty audio');
  return buf;
}

// StreamElements — English-only fallback
const SE_VOICES = new Set(['Brian','Amy','Emma','Joanna','Joey','Justin','Kendra','Kimberly','Matthew','Salli','Nicole','Russell','Geraint']);
async function fetchStreamElements(text, voice = 'Brian') {
  const v = SE_VOICES.has(voice) ? voice : 'Brian';
  const res = await fetch(
    `https://api.streamelements.com/kappa/v2/speech?voice=${v}&text=${encodeURIComponent(text)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) throw new Error(`StreamElements ${res.status}`);
  return await res.arrayBuffer();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const text  = (searchParams.get('text')  || '').slice(0, 500).trim();
  const voice = searchParams.get('voice') || 'Brian';
  const lang  = searchParams.get('lang')  || 'en';

  if (!text) return new Response('Missing text', { status: 400 });

  // Google TTS first (supports all languages including Hindi)
  try {
    const audio = await fetchGoogleTTS(text, lang);
    return new Response(audio, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {}

  // StreamElements fallback — English only
  if (lang === 'en') {
    try {
      const audio = await fetchStreamElements(text, voice);
      return new Response(audio, {
        headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' },
      });
    } catch {}
  }

  return new Response('All TTS sources failed', { status: 502 });
}
