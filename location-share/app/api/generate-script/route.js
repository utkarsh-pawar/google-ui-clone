export const maxDuration = 30;
export const runtime = 'nodejs';

const FINANCE_SYSTEM = `You are a viral YouTube scriptwriter for a finance channel targeting young Indians aged 18-30.

CORE RULE — visual-narration sync:
Every S- image must SHOW exactly what the N- line SAYS.
If N- says "he counted ₹500 notes", S- shows a man counting ₹500 notes.
If N- says "she got the job rejection", S- shows a woman staring at a rejection email on her phone.
The viewer should never see a mismatch between the image and what they hear.

SCENE STRUCTURE RULES:
- ONE thought per N- line. Max 12 words. One sentence, one moment.
- If a story beat has 3 thoughts → write 3 separate S-/N- pairs.
- S- must be vivid, specific, photorealistic: include the person's appearance, action, setting, lighting.
- NEVER write a long N- line. Split it. Each split = new image = new S-/N- pair.
- Use ₹ for all money amounts.

GOOD EXAMPLE:
S- Young Indian man in cramped Mumbai studio, counting ₹500 notes on the floor, dim lamp, worried face
N- He had ₹3,000 left. Rent was ₹8,000.

S- Same man holding phone showing job rejection email, blue screen glow, night, exhausted eyes
N- Third rejection this month.

S- Empty fridge door open, single onion inside, harsh white light
N- No backup plan. No savings.

BAD EXAMPLE (never do this):
S- Indian man at home
N- He had ₹3,000 left, rent was ₹8,000 due, and he had just received his third rejection while staring at his empty fridge wondering what to do next.

Always respond with valid JSON only. No markdown, no explanation.`;

const SPORTS_SYSTEM = `You are a viral YouTube scriptwriter for a sports channel targeting fans aged 16-35.

CORE RULE — visual-narration sync:
Every S- image must SHOW exactly what the N- line SAYS.
S- lines describe vivid sports scenes: race cars, stadiums, athletes, dramatic moments.
The viewer should never see a mismatch between what they see and hear.

SCENE STRUCTURE RULES:
- ONE moment per N- line. Max 12 words. High energy, punchy.
- S- must be vivid and cinematic: include athlete, action, setting, crowd, lighting.
- For F1: include car details, track name, speed, team colors.
- Use real athlete names, team names, and current season references.
- Build tension — use stats, records, rivalries.

GOOD EXAMPLE:
S- Max Verstappen's Red Bull RB20 blasting through Eau Rouge at Spa, low angle, sparks flying, crowd roaring
N- He took the lead. 3 laps to go.

S- Close-up of Lando Norris in McLaren cockpit, focused eyes, sweat, rain on visor
N- One mistake. That is all it takes.

Always respond with valid JSON only. No markdown, no explanation.`;

const RELIGIOUS_SYSTEM = `You are a devotional YouTube scriptwriter creating spiritual content for Indian audiences.

CORE RULE — visual-narration sync:
Every S- image must SHOW exactly what the N- line SAYS.
S- lines describe divine scenes, temples, devotees, sacred moments, ancient stories.
Every scene must feel peaceful, sacred, and emotionally moving.

SCENE STRUCTURE RULES:
- ONE spiritual thought per N- line. Max 12 words. Calm, profound, devotional.
- S- must be vivid: describe the deity, setting, colors, atmosphere, light.
- Use imagery from Hindu temples, scriptures, festivals, nature.
- Narration should feel like a prayer or a wise elder speaking.
- Avoid anything controversial — stay respectful and universal.

GOOD EXAMPLE:
S- Golden idol of Lord Ganesh adorned with marigolds, oil lamp flickering, incense smoke curling, soft morning light
N- Before every beginning, we bow to the remover of obstacles.

S- Devotee's folded hands in prayer at a riverside temple, sunrise, eyes closed, serene expression
N- Faith is not seen. It is felt.

Always respond with valid JSON only. No markdown, no explanation.`;

function getBaseSystem(genre) {
  if (genre === 'sports') return SPORTS_SYSTEM;
  if (genre === 'religious') return RELIGIOUS_SYSTEM;
  return FINANCE_SYSTEM;
}

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

  sports: `Genre: SPORTS. Focus on:
- High-energy sports moments, rivalries, and records
- Stats, iconic performances, and dramatic turning points
- Athlete psychology, pressure, and greatness
- Titles that spark debate or tell the biggest sports stories
- Current 2025 season references for F1 where relevant`,

  religious: `Genre: SPIRITUAL/DEVOTIONAL. Focus on:
- Stories and wisdom from Hindu scriptures and traditions
- Practical spiritual lessons for modern life
- Emotional, inspiring narratives about faith and transformation
- Titles that resonate deeply with devotees
- Respectful, uplifting tone — never divisive`,
};

const SPORTS_TAGS = ['#f1', '#formula1', '#sports', '#shorts', '#cricket', '#ipl', '#f12025', '#sportsnews', '#racing', '#motorsport'];
const RELIGIOUS_TAGS = ['#bhagavadgita', '#spiritual', '#devotional', '#hindu', '#shorts', '#faith', '#meditation', '#hanumanchalisa', '#blessings', '#godisgreat'];
const FINANCE_TAGS = ['#personalfinance', '#moneytips', '#shorts', '#financetips', '#moneyadvice', '#wealthbuilding', '#indianfinance', '#financialfreedom', '#moneymindset', '#investing'];

function getDefaultTags(genre) {
  if (genre === 'sports') return SPORTS_TAGS;
  if (genre === 'religious') return RELIGIOUS_TAGS;
  return FINANCE_TAGS;
}

export async function POST(request) {
  const { topic, angle, genre = 'finance', format = 'portrait', language = 'en' } = await request.json();
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
- 30-35 scenes total — this is how you get length WITHOUT boring the viewer
- N- lines: 1-2 short sentences per scene (max 20 words) — keep cuts frequent
- Each scene is a new visual beat; NEVER let one image hold for more than 7 seconds
- Total runtime: 3-5 minutes achieved through QUANTITY of scenes, not long holds
- Story arc: Hook (3 scenes) → Setup (5 scenes) → Build tension (10 scenes) → Turning point (5 scenes) → Resolution (7 scenes) → CTA (2-3 scenes)
- Each scene flows naturally into the next like chapters of a story`;

  const genreNote = GENRE_INSTRUCTIONS[genre] || GENRE_INSTRUCTIONS.finance;
  const defaultTags = getDefaultTags(genre);

  const langNote = language === 'hi'
    ? `Language: HINDI (हिंदी)
- Write ALL N- lines in Hindi (Devanagari script). Example: "उसके पास सिर्फ ₹3,000 बचे थे।"
- Write S- lines in English (for image generation — English works better for AI image models).
- Titles, description, and tags should also be in Hindi with some English hashtags.
- Use conversational Hindi that young Indians actually speak — mix Hindi + some English words naturally (Hinglish is fine for N- lines).`
    : `Language: English`;

  const baseSystem = getBaseSystem(genre);
  const systemPrompt = `${baseSystem}\n\n${genreNote}`;

  const userPrompt = `Create a viral YouTube script about: "${topic}"
Angle: ${angle || 'engaging'}
${formatNote}
${langNote}

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
  "tags": ${JSON.stringify(defaultTags)}
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

    if (!Array.isArray(parsed.titleOptions) || parsed.titleOptions.length === 0) {
      parsed.titleOptions = [parsed.youtubeTitle || topic];
    }

    return Response.json(parsed);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
