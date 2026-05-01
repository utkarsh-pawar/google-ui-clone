export const maxDuration = 30;

const GEMINI_MODEL = 'gemini-1.5-flash';

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: 'GEMINI_API_KEY not set in environment' }, { status: 500 });

  const prompt = `${SYSTEM_PROMPT}

Create a viral YouTube Shorts script about: "${topic}"
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
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 1500,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(25000),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Gemini ${res.status}`);
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    const json = JSON.parse(raw);
    return Response.json(json);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
