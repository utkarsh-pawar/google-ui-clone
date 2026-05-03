export const maxDuration = 30;

// ── Character → voice gender mapping ────────────────────────────────────────
const MALE_CHARS = new Set([
  'ramesh','ram','suresh','mohan','rajesh','raj','papa','father','baba','dada',
  'beta','anil','rahul','vikram','arjun','ravi','deepak','ajay','amit','nikhil',
  'rohit','vivek','narrator_male',
]);
const FEMALE_CHARS = new Set([
  'sunita','sita','seema','mama','mother','priya','anita','meena','kavita','pooja',
  'didi','rani','devi','nani','rekha','geeta','neha','ritu','kavya','lalita',
  'narrator_female',
]);

function getGender(character) {
  const lc = (character || '').toLowerCase().trim();
  if (MALE_CHARS.has(lc)) return 'male';
  if (FEMALE_CHARS.has(lc)) return 'female';
  return 'narrator'; // default: female narrator
}

// ── Google Cloud TTS — supports Hindi multi-voice ────────────────────────────
// Hindi voices: hi-IN-Standard-A (F), hi-IN-Standard-B (M), hi-IN-Standard-C (M), hi-IN-Standard-D (F)
// English voices: en-US-Standard-B (M), en-US-Standard-C (F), en-US-Standard-D (M)
function getGoogleCloudVoice(lang, gender) {
  if (lang === 'hi') {
    if (gender === 'male') return { languageCode: 'hi-IN', name: 'hi-IN-Standard-B' };
    if (gender === 'narrator') return { languageCode: 'hi-IN', name: 'hi-IN-Standard-D' };
    return { languageCode: 'hi-IN', name: 'hi-IN-Standard-A' }; // female
  }
  // English
  if (gender === 'male') return { languageCode: 'en-US', name: 'en-US-Standard-D' };
  return { languageCode: 'en-US', name: 'en-US-Standard-C' }; // female / narrator
}

async function fetchGoogleCloudTTS(text, lang, character) {
  const apiKey = process.env.GOOGLE_TTS_KEY;
  if (!apiKey) throw new Error('No GOOGLE_TTS_KEY');

  const gender = getGender(character);
  const voice = getGoogleCloudVoice(lang, gender);

  // Slightly higher pitch + faster rate for child characters
  const isChild = ['priya','beta','beti','ladki','ladka'].includes((character || '').toLowerCase());
  const speakingRate = isChild ? 1.1 : gender === 'male' ? 0.88 : 0.92;
  const pitch = isChild ? 3 : gender === 'male' ? -2 : 0;

  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice,
        audioConfig: { audioEncoding: 'MP3', speakingRate, pitch },
      }),
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google Cloud TTS ${res.status}: ${body.slice(0, 120)}`);
  }
  const data = await res.json();
  if (!data.audioContent) throw new Error('Google Cloud TTS: empty audioContent');
  return Buffer.from(data.audioContent, 'base64');
}

// ── Google Translate TTS — free, single voice per language ───────────────────
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

// ── StreamElements — English-only fallback ───────────────────────────────────
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
  const text      = (searchParams.get('text')      || '').slice(0, 500).trim();
  const voice     = searchParams.get('voice')     || 'Brian';
  const lang      = searchParams.get('lang')      || 'en';
  const character = searchParams.get('character') || '';

  if (!text) return new Response('Missing text', { status: 400 });

  // 1. Google Cloud TTS — best quality, true multi-voice (requires GOOGLE_TTS_KEY)
  if (process.env.GOOGLE_TTS_KEY) {
    try {
      const audio = await fetchGoogleCloudTTS(text, lang, character);
      return new Response(audio, {
        headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' },
      });
    } catch (e) {
      console.warn('Google Cloud TTS failed, falling back:', e.message);
    }
  }

  // 2. Google Translate TTS — free, single voice, supports Hindi
  try {
    const audio = await fetchGoogleTTS(text, lang);
    return new Response(audio, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {}

  // 3. StreamElements — English only
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
