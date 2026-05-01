import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  const userPrompt = `Create a viral YouTube Shorts script about: "${topic}"
Angle: ${angle || 'motivational'}

Return JSON:
{
  "script": "S- [vivid image prompt]\\nN- [short punchy narration]\\n\\nS- ...\\nN- ...",
  "suggestedTitle": "Bold 6-8 word hook title for video overlay",
  "youtubeTitle": "Viral YouTube title under 60 chars with emoji",
  "description": "3-line YouTube description with hook, value, and CTA. Include relevant hashtags at end.",
  "tags": ["#personalfinance", "#moneytips", ...8 more relevant tags]
}`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = msg.content[0].text.trim();
    const json = JSON.parse(raw.startsWith('```') ? raw.replace(/```json?\n?/g, '').replace(/```$/g, '') : raw);
    return Response.json(json);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
