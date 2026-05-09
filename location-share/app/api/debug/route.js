export async function GET() {
  const elevenlabs = process.env.ELEVENLABS_API_KEY;
  const googleTts  = process.env.GOOGLE_TTS_KEY;

  const ttsSource = elevenlabs ? 'elevenlabs (multi-voice, natural)'
    : googleTts  ? 'google-cloud-wavenet (natural Hindi/English)'
    : 'google-translate (free but robotic) — set ELEVENLABS_API_KEY to upgrade';

  return Response.json({
    tts_active_source: ttsSource,
    ELEVENLABS_API_KEY: elevenlabs ? `set (${elevenlabs.slice(0, 8)}...)` : 'NOT SET — get free key at elevenlabs.io',
    GOOGLE_TTS_KEY:     googleTts  ? `set (${googleTts.slice(0, 8)}...)`  : 'NOT SET',
    CEREBRAS_API_KEY:   process.env.CEREBRAS_API_KEY ? `set (${process.env.CEREBRAS_API_KEY.slice(0, 8)}...)` : 'NOT SET',
    script_model:       'llama3.3-70b (upgraded)',
    image_model:        'flux via pollinations',
    YOUTUBE_CLIENT_ID:  process.env.YOUTUBE_CLIENT_ID  ? 'set' : 'NOT SET',
    YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET ? 'set' : 'NOT SET',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
  });
}
