export const maxDuration = 30;
export const runtime = 'nodejs';

import {
  SPIRITUAL_CHANNEL_PERSONA,
  CONTENT_ANGLES,
  getUpcomingFestival,
  getTodayDeity,
} from '@/lib/spiritualManager';

// Groq decides today's video: deity + angle + topic sentence
// Returns { deity, angle, topic, hook, whyNow }
async function askGroqForTodaysTopic(recentTopics = [], performanceSummary = '') {
  const groqKey = process.env.GROQ_API_KEY;
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  if (!groqKey && !cerebrasKey) throw new Error('No LLM API key configured');

  const festival   = getUpcomingFestival();
  const todayDeity = getTodayDeity();
  const avoidList  = recentTopics.slice(0, 14).join(', ') || 'none yet';

  const systemPrompt = `${SPIRITUAL_CHANNEL_PERSONA}

Today's scheduled deity: ${todayDeity.deity} — ${todayDeity.focus}
${festival ? `UPCOMING FESTIVAL (within 3 days): ${festival.name} on ${festival.day}/${festival.month + 1} — prioritise this deity: ${festival.deity}` : ''}
Recently used topics (DO NOT repeat these): ${avoidList}

${performanceSummary || 'No performance data yet — follow the default deity schedule.'}

Pick the best video idea for today. Use performance data to choose the highest-potential deity + angle combination.
Respond with valid JSON only.`;

  const userPrompt = `Decide today's spiritual video for the channel.

Return JSON:
{
  "deity": "Which Hindu god/goddess is this video about",
  "angle": "shloka | story | prayer | teaching | festival",
  "topic": "The specific video topic in 10 words or less (in English — for internal use)",
  "hindiTitle": "The video title in Hindi Devanagari (compelling, under 60 chars)",
  "hook": "First line that stops the scroll — in Hindi Devanagari (under 15 words)",
  "whyNow": "One sentence: why this topic is especially relevant right now"
}`;

  const isGroq  = !!groqKey;
  const url     = isGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.cerebras.ai/v1/chat/completions';
  const key     = isGroq ? groqKey : cerebrasKey;
  const model   = isGroq ? 'llama-3.3-70b-versatile' : 'llama3.1-8b';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      max_tokens: 400,
      temperature: 0.8,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content.trim());
}

// GET — returns today's recommended topic without generating script
// POST — generates full script for the decided topic and pushes to queue
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const recentRaw        = searchParams.get('recent')      || '';
  const performanceSummary = searchParams.get('performance') || '';
  const recentTopics     = recentRaw ? recentRaw.split('|') : [];

  try {
    const decision = await askGroqForTodaysTopic(recentTopics, performanceSummary);
    return Response.json({ ok: true, decision, decidedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { recentTopics = [], channelId = 'chants', autoQueue = false, performanceSummary = '' } = await request.json();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    // Step 1: AI decides today's topic (with performance data if available)
    const decision = await askGroqForTodaysTopic(recentTopics, performanceSummary);

    // Step 2: Generate full script for that topic
    const scriptRes = await fetch(`${appUrl}/api/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: decision.topic,
        angle: decision.angle,
        genre: 'chants',
        format: 'portrait',
        language: 'hi',
        deity: decision.deity,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!scriptRes.ok) throw new Error(`Script generation failed: ${scriptRes.status}`);
    const script = await scriptRes.json();

    const result = {
      decision,
      script: script.script,
      youtubeTitle: decision.hindiTitle || script.youtubeTitle,
      youtubeDescription: script.description || '',
      youtubeTags: script.tags || [],
      titleText: decision.hook || script.suggestedTitle || '',
      generatedAt: new Date().toISOString(),
    };

    // Step 3: Push to queue if autoQueue is true (cron mode)
    if (autoQueue) {
      const secret = process.env.CRON_SECRET || '';
      await fetch(`${appUrl}/api/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
        body: JSON.stringify({
          channelId,
          style: 'divine',
          format: 'portrait',
          language: 'hi',
          topic: decision.topic,
          deity: decision.deity,
          ...result,
        }),
      });
    }

    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
