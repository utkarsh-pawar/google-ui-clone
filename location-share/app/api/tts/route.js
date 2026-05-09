export const maxDuration = 30;

// ── Character → voice gender ─────────────────────────────────────────────────
const MALE_CHARS = new Set([
  'ramesh','ram','suresh','mohan','rajesh','raj','papa','father','baba','dada',
  'anil','rahul','vikram','arjun','ravi','deepak','ajay','amit','nikhil','rohit','vivek',
]);
const CHILD_CHARS = new Set(['priya','beta','beti','ladki','ladka','chhotu','munna','babli']);
const FEMALE_CHARS = new Set([
  'sunita','sita','seema','mama','mother','anita','meena','kavita','pooja',
  'didi','rani','devi','nani','rekha','geeta','neha','ritu','kavya','lalita',
]);

function getGender(character) {
  const lc = (character || '').toLowerCase().trim();
  if (MALE_CHARS.has(lc))  return 'male';
  if (CHILD_CHARS.has(lc)) return 'child';
  if (FEMALE_CHARS.has(lc)) return 'female';
  return 'narrator';
}

// ── ElevenLabs — free tier (10k chars/mo), no billing needed ────────────────
// eleven_multilingual_v2 speaks Hindi natively with any voice
const EL_VOICES = {
  male:     'pNInz6obpgDQGcFmaJgB', // Adam  — deep, authoritative
  female:   'AZnzlk1XvdvUeBnXmlld', // Domi  — strong, distinct from narrator
  child:    'MF3mGyEYCl7XYWbV9V9N', // Elli  — young, bright
  narrator: '21m00Tcm4TlvDq8ikWAM', // Rachel — calm, clear narrator
};

async function fetchElevenLabs(text, character) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('No ELEVENLABS_API_KEY');

  const gender   = getGender(character);
  const voiceId  = EL_VOICES[gender];

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key':   apiKey,
        'Content-Type': 'application/json',
        'Accept':       'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      }),
      signal: AbortSignal.timeout(20000),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 120)}`);
  }
  return await res.arrayBuffer();
}

// ── Google Cloud TTS — Wavenet voices (free 1M chars/mo) ────────────────────
// Wavenet is far more natural than Standard — use it for all Hindi content
function getGoogleCloudVoice(lang, gender) {
  if (lang === 'hi') {
    // Wavenet first, Neural2 is even better but costs more
    if (gender === 'male')     return { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-B' }; // deep, authoritative
    if (gender === 'narrator') return { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-D' }; // warm female narrator
    if (gender === 'child')    return { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-A' }; // bright
    return { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-A' };                            // female
  }
  if (gender === 'male') return { languageCode: 'en-US', name: 'en-US-Wavenet-D' };
  return { languageCode: 'en-US', name: 'en-US-Wavenet-C' };
}

async function fetchGoogleCloudTTS(text, lang, character, style) {
  const apiKey = process.env.GOOGLE_TTS_KEY;
  if (!apiKey) throw new Error('No GOOGLE_TTS_KEY');

  const gender  = getGender(character);
  const voice   = getGoogleCloudVoice(lang, gender);
  const isChild = gender === 'child';
  const isSpiritual = style === 'spiritual';
  // Spiritual content needs slower, more meditative pacing
  const speakingRate = isChild ? 1.05 : isSpiritual ? 0.78 : gender === 'male' ? 0.88 : 0.92;
  const pitch = isChild ? 3 : isSpiritual ? -1 : gender === 'male' ? -2 : 0;

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

// ── Google Translate TTS — free, no key, no credit card ──────────────────────
async function fetchGoogleTTS(text, lang = 'en', style = '') {
  const speed = style === 'spiritual' ? 0.7 : 0.9; // slower for chants/wisdom
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&total=1&idx=0&textlen=${text.length}&client=tw-ob&prev=input&ttsspeed=${speed}`;
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
  const style     = searchParams.get('style')     || '';

  if (!text) return new Response('Missing text', { status: 400 });

  // 1. ElevenLabs — free tier, no billing, true multi-voice (ELEVENLABS_API_KEY)
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const audio = await fetchElevenLabs(text, character);
      return new Response(audio, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
          'X-TTS-Source': 'elevenlabs',
        },
      });
    } catch (e) {
      console.warn('ElevenLabs failed, falling back:', e.message);
    }
  }

  // 2. Google Cloud TTS — multi-voice Hindi/English (GOOGLE_TTS_KEY, requires billing)
  if (process.env.GOOGLE_TTS_KEY) {
    try {
      const audio = await fetchGoogleCloudTTS(text, lang, character, style);
      return new Response(audio, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
          'X-TTS-Source': 'google-cloud',
        },
      });
    } catch (e) {
      console.warn('Google Cloud TTS failed, falling back:', e.message);
    }
  }

  // 3. Google Translate TTS — free, single voice, Hindi works
  try {
    const audio = await fetchGoogleTTS(text, lang, style);
    return new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'X-TTS-Source': 'google-translate',
      },
    });
  } catch {}

  // 4. StreamElements — English only
  if (lang === 'en') {
    try {
      const audio = await fetchStreamElements(text, voice);
      return new Response(audio, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
          'X-TTS-Source': 'streamelements',
        },
      });
    } catch {}
  }

  return new Response('All TTS sources failed', { status: 502 });
}
