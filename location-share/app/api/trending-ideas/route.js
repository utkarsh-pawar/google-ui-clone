export const maxDuration = 30;
export const runtime = 'nodejs';

const FINANCE_TRENDS = `
You are a viral content researcher for a finance channel targeting young Indians (18-30) in 2026.
Think about what's actually trending RIGHT NOW in May 2026:
- India's economic news, new budget policies, tax changes
- Stock market movements, IPOs, new investment products
- Real estate vs renting debate, rising EMIs
- New-age income sources: freelancing, creator economy, AI tools for money-making
- Generational wealth gap, inflation hitting millennials
- Controversial takes that are going viral (e.g. "FDs are dead", "Mutual funds are a scam")
- Real stories circulating on Reddit/Twitter about debt, savings breakthroughs
`;

const SPORTS_TRENDS = `
You are a viral sports content researcher for a channel targeting fans (16-35) in May 2026:
- F1 2026: new engine regulations just kicked in, team power shifts, driver drama
- IPL 2026 season mid-tournament drama, surprise performances
- Recent India cricket news, Test series, player controversies
- GOAT debates that are blowing up online
- Underdog stories and shocking upsets from the last 30 days
- Records just broken or about to be broken
- Transfer rumors and contract drama (football, cricket auctions)
`;

const RELIGIOUS_TRENDS = `
You are a viral devotional content researcher for a spiritual channel targeting Indian audiences in May 2026:
- Upcoming Hindu festivals and their significance (what's coming in the next 30 days)
- Viral temple events, temple visits by celebrities going viral
- Ancient wisdom that's getting rediscovered and trending on social media
- Modern problems (anxiety, loneliness, career stress) that scriptural answers address
- Devotional content formats that are getting massive engagement right now
- Faith stories that are circulating and making people emotional
- Pilgrimage routes going viral on Instagram/YouTube
`;

function getTrendContext(genre) {
  if (genre === 'sports') return SPORTS_TRENDS;
  if (genre === 'religious') return RELIGIOUS_TRENDS;
  return FINANCE_TRENDS;
}

const GENRE_INSTRUCTIONS = {
  motivation: 'Focus on: mindset shifts, wake-up calls, hard truths about money and ambition that are spreading virally.',
  finance:    'Focus on: specific numbers, "secrets" banks hide, investment strategies getting attention, money mistakes going viral.',
  stories:    'Focus on: real-feeling transformation stories, specific people with specific journeys that feel authentic and relatable.',
  sports:     'Focus on: peak drama, records, rivalries, moments that make fans want to debate and share.',
  religious:  'Focus on: emotional resonance, ancient wisdom solving modern problems, miracle/transformation angles that make people save and share.',
};

export async function POST(request) {
  const { genre = 'finance', channelId = 'general', language = 'en' } = await request.json();

  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) return Response.json({ error: 'CEREBRAS_API_KEY not set' }, { status: 500 });

  const trendContext = getTrendContext(genre);
  const genreInstruction = GENRE_INSTRUCTIONS[genre] || GENRE_INSTRUCTIONS.finance;
  const langNote = language === 'hi' ? 'Write topic titles in Hindi (Devanagari). Keep whyTrending and hook in English.' : '';

  const systemPrompt = `${trendContext}
Your job: generate 10 trending video topic ideas that would perform well RIGHT NOW on YouTube Shorts.
${genreInstruction}
${langNote}
Always respond with valid JSON only. No markdown, no explanation.`;

  const userPrompt = `Generate exactly 10 trending YouTube Shorts topic ideas for a ${genre} channel. Current date: May 2026.

Each idea must feel timely — something people are searching for or talking about RIGHT NOW.

Return JSON:
{
  "ideas": [
    {
      "topic": "The specific video topic (max 12 words)",
      "angle": "the virality angle in 2-3 words (e.g. controversy, shocking-stat, transformation)",
      "hook": "The first sentence that would stop the scroll (max 15 words)",
      "whyTrending": "One line: why this is relevant RIGHT NOW in 2026 (max 12 words)"
    }
  ]
}`;

  try {
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama3.1-8b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.9,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      let errMsg = `Cerebras ${res.status}`;
      try { errMsg = JSON.parse(errBody)?.error?.message || errMsg; } catch {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed.ideas) || parsed.ideas.length === 0) {
      throw new Error('No ideas returned');
    }

    return Response.json({ ideas: parsed.ideas.slice(0, 10) });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
