export const maxDuration = 30;
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are a viral YouTube Shorts scriptwriter for a finance channel targeting young Indians aged 18-30.

Your scripts must:
- Hook the viewer in the first 3 seconds with a shocking stat, relatable pain, or contrast
- Use short, punchy sentences (max 12 words per N- line)
- Build emotional tension then resolve with actionable insight
- Use ₹ for all money amounts (Indian audience)
- Be 9-11 scenes (perfect for 30-45 second Shorts)
- Have visual variety in S- descriptions

S- lines are image generation prompts: vivid, specific, photorealistic descriptions.
N- lines are TTS narration + subtitle text: short, punchy, conversational.

Always respond with valid JSON only. No markdown, no explanation.`;

export async function POST(request) {
  const { topic, angle } = await request.json();
  if (!topic) return Response.json({ error: 'Missing topic' }, { status: 400 });

  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) return Response.json({ error: 'CEREBRAS_API_KEY not set' }, { status: 500 });

  const userPrompt = `Create a viral YouTube Shorts script about: "${topic}"
Angle: ${angle || 'motivational'}

Return JSON only:
{
  "script": "S- [vivid image prompt]\\nN- [short punchy narration]\\n\\nS- ...\\nN- ...",
  "suggestedTitle": "Bold 6-8 word hook title for video overlay",
  "youtubeTitle": "Viral YouTube title under 60 chars with emoji",
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
        model: 'llama-3.3-70b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.9,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Groq ${res.status}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    return Response.json(JSON.parse(raw));
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
