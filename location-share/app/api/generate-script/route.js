export const maxDuration = 30;
export const runtime = 'nodejs';

const BASE_SYSTEM = `You are a viral YouTube scriptwriter for a finance channel targeting young Indians aged 18-30.

Your scripts must:
- Hook the viewer in the first 3 seconds with a shocking stat, relatable pain, or contrast
- Build emotional tension then resolve with actionable insight
- Use ₹ for all money amounts (Indian audience)
- Have visual variety in S- descriptions
- Follow the scene count and narration length specified in the format instructions exactly

S- lines are image generation prompts: vivid, specific, photorealistic descriptions.
N- lines are TTS narration + subtitle text.

Always respond with valid JSON only. No markdown, no explanation.`;

const GENRE_INSTRUCTIONS = {
  motivation: `Genre: MOTIVATIONAL. Focus on:
- Emotional hooks and mindset breakthroughs
- "You can change this" energy backed by real finance
- Challenge the viewer's limiting beliefs about money
- Titles that create urgency and self-reflection`,

  finance: `Genre: EDUCATIONAL FINANCE. Focus on:
- Specific numbers, percentages, and timeframes
- Step-by-step actionable strategies
- Data-driven claims and evidence
- Titles that promise clear, specific value`,

  stories: `Genre: STORY-BASED. Focus on:
- A specific person's journey (real or composite)
- Structure: struggle → turning point → transformation
- Emotional narrative with financial lessons woven in
- Titles that name a character or use "I/my" for relatability`,
};

export async function POST(request) {
  const { topic, angle, genre = 'finance', format = 'portrait' } = await request.json();
  if (!topic) return Response.json({ error: 'Missing topic' }, { status: 400 });

  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) return Response.json({ error: 'CEREBRAS_API_KEY not set' }, { status: 500 });

  const isShorts = format === 'portrait';
  const formatNote = isShorts
    ? `Format: YouTube Shorts (9:16 vertical)
- 9-11 scenes total
- N- lines: max 12 words, punchy, one idea per line
- Total runtime: 30-45 seconds
- Fast cuts, high energy`
    : `Format: YouTube Video (16:9 landscape)
- 20-25 scenes total — build a full engaging story
- N- lines: 2-3 complete sentences per scene, conversational storytelling tone
- Total runtime: 3-5 minutes
- Story arc required: Hook (2 scenes) → Setup/conflict (5 scenes) → Build tension (8 scenes) → Turning point (3 scenes) → Resolution/lesson (4 scenes) → Call to action (2 scenes)
- Each scene should naturally flow into the next like chapters of a story`;

  const genreNote = GENRE_INSTRUCTIONS[genre] || GENRE_INSTRUCTIONS.finance;

  const systemPrompt = `${BASE_SYSTEM}\n\n${genreNote}`;

  const userPrompt = `Create a viral YouTube script about: "${topic}"
Angle: ${angle || 'motivational'}
${formatNote}

Return JSON only:
{
  "script": "S- [vivid image prompt]\\nN- [short punchy narration]\\n\\nS- ...\\nN- ...",
  "titleOptions": [
    "Hook title option 1 — shocking or contrarian angle",
    "Hook title option 2 — curiosity or mystery angle",
    "Hook title option 3 — clear value or benefit angle"
  ],
  "suggestedTitle": "Bold 6-8 word overlay title for first scene",
  "youtubeTitle": "Best of the 3 title options (under 60 chars with emoji)",
  "description": "3-line YouTube description with hook, value, and CTA. Include relevant hashtags at end.",
  "tags": ["#personalfinance", "#moneytips", "#shorts", "#financetips", "#moneyadvice", "#wealthbuilding", "#indianfinance", "#financialfreedom", "#moneymindset", "#investing"]
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
        max_tokens: 1800,
        temperature: 0.9,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      let errMsg = `Cerebras ${res.status}`;
      try { errMsg = JSON.parse(errBody)?.error?.message || errMsg; } catch {}
      throw new Error(`${errMsg} | body: ${errBody.slice(0, 300)}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    const parsed = JSON.parse(raw);

    // Ensure titleOptions is always an array of 3
    if (!Array.isArray(parsed.titleOptions) || parsed.titleOptions.length === 0) {
      parsed.titleOptions = [parsed.youtubeTitle || topic];
    }

    return Response.json(parsed);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
