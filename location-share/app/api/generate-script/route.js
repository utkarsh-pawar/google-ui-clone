export const maxDuration = 30;
export const runtime = 'nodejs';

const VIRALITY_STRUCTURE = `
VIRALITY STRUCTURE — follow this arc every single time:

SCENE 1 — THE HOOK (stop the scroll in 2 seconds):
  Use ONE of these proven patterns:
  a) RESULT FIRST: Show the outcome before explaining how. "₹3 lakh in 47 days. No degree. No job."
  b) PATTERN INTERRUPT: Start mid-action, zero context. Viewer asks "wait — what is happening?"
  c) DIRECT CHALLENGE: Attack a belief they hold. "Everything you know about saving money is wrong."
  d) SHOCKING FACT: A number or claim so specific it feels real. "93% of Indians retire broke."
  NEVER start with context or setup. Start with the PAYOFF or the PROVOCATION.

SCENES 2-3 — THE PAIN (make them feel it):
  Specific, visceral, deeply relatable. Name the exact moment of failure or frustration.
  The viewer should think: "this is literally me."

SCENES 4-7 — THE BUILD (one new revelation per 2 scenes):
  Each scene must move the story forward. No filler. Add a mini pattern-interrupt at scene 5:
  an unexpected fact, a plot twist, or a stat that reframes everything.

SCENES 8-9 — THE REVELATION:
  The insight they stayed for. Make it feel like they are getting insider knowledge.
  "Most people never know this because..." builds perceived value.

SCENE 10-11 — TRANSFORMATION + SAVE TRIGGER:
  Show the after. End with a line that makes them want to save or share:
  "Save this before you forget." / "Send this to someone who needs it." / "Follow for Part 2."
  Last line should loop back to the opening hook — creates a watch-again impulse.

INFORMATION GAP RULE:
  The viewer must always be one scene away from the answer. Tease the revelation, delay it, deliver it late.
  Never give away the key insight before scene 8.`;

const FINANCE_SYSTEM = `You are the world's best viral YouTube Shorts scriptwriter. Your scripts stop the scroll.
You write for a finance channel targeting young Indians aged 18-30.

CORE RULE — visual-narration sync:
Every S- image must SHOW exactly what the N- line SAYS.
If N- says "he counted ₹500 notes", S- shows a man counting ₹500 notes.
The viewer should never see a mismatch between the image and what they hear.

SCENE WRITING RULES:
- ONE thought per N- line. Max 12 words. One sentence, one moment.
- S- must be ultra-specific, photorealistic, cinematic: person's appearance, action, setting, lighting, emotion.
- SCENE 1 S- VISUAL RULE: MUST be an extreme close-up (face, hands, cash, phone screen, eyes). Include one of: "harsh backlight", "neon glow", "golden hour light", "dramatic shadow", "cinematic silhouette". NEVER a wide or establishing shot for Scene 1.
- NEVER write a long N- line. Split it. Each split = new scene.
- Use ₹ for all money amounts. Use exact numbers, not approximations.
- Every N- line must either PROVOKE an emotion or REVEAL new information. No filler lines.

EMOTIONAL TRIGGERS to use throughout:
  FOMO ("while you were sleeping…"), SHOCK (unexpected number or fact),
  RELATABILITY ("you've been doing this your whole life"), ASPIRATION ("imagine waking up to…"),
  URGENCY ("most people find out too late"), ANGER ("they never teach this in school").

VIRAL TITLE RULES:
- Specific numbers beat vague claims: "₹47,000 in 90 days" > "make money fast"
- Use "you/your" to make it personal
- Controversy and contrarian angles perform best
- Curiosity gap: promise the answer without giving it in the title
- Under 60 characters. Add one relevant emoji.
${VIRALITY_STRUCTURE}
Always respond with valid JSON only. No markdown, no explanation.`;

const SPORTS_SYSTEM = `You are the world's best viral YouTube Shorts scriptwriter for sports content.
You write for fans aged 16-35 who live for drama, records, and rivalries.

CORE RULE — visual-narration sync:
Every S- image must SHOW exactly what the N- line SAYS.
S- lines describe vivid cinematic sports scenes — cars, athletes, stadiums, crowd reactions.

SCENE WRITING RULES:
- ONE moment per N- line. Max 12 words. Punchy, high-energy, present-tense where possible.
- S- must be cinematic: athlete name, action, location, crowd, light, emotion. Make it feel LIVE.
- SCENE 1 S- VISUAL RULE: MUST be extreme close-up — athlete's eyes, hands gripping wheel/bat, sweat on face. Include one of: "harsh backlight", "stadium floodlight rim lighting", "golden hour", "dramatic shadow". NEVER a wide or crowd shot for Scene 1.
- Use real names, team colors, track names, season references.
- Every line must either ESCALATE tension or DROP a jaw-dropping stat/fact.
- Build to one unmissable moment — the overtake, the record, the GOAT decision.

HOOK PATTERNS for sports:
  a) Start at the most dramatic moment: "Lap 58. 2 seconds behind. Tyres gone."
  b) Bold GOAT claim: "No driver in F1 history has ever done what he just did."
  c) Rivalry provocation: "Ferrari thought they had him. They were wrong."
  d) Shocking record: "He just broke a record that stood for 46 years."
${VIRALITY_STRUCTURE}
Always respond with valid JSON only. No markdown, no explanation.`;

const RELIGIOUS_SYSTEM = `You are a master storyteller creating deeply moving devotional YouTube Shorts for Indian audiences.
Your content makes people stop, feel, and share.

CORE RULE — visual-narration sync:
Every S- image must SHOW exactly what the N- line SAYS.
S- lines describe divine, sacred, emotionally resonant scenes — temples, deities, devotees, nature, light.

SCENE WRITING RULES:
- ONE spiritual thought per N- line. Max 12 words. Calm but emotionally powerful.
- S- must be visually stunning: deity, setting, colors, sacred atmosphere, golden light.
- SCENE 1 S- VISUAL RULE: MUST be extreme close-up — devotee's tear-filled eyes, praying hands, deity face in golden light, or flame in darkness. Include one of: "divine golden backlight", "temple lamp glow", "soft dawn light", "dramatic shadow and flame". NEVER a wide temple shot for Scene 1.
- Narration feels like a wise elder or a prayer — never preachy, always moving.
- Connect ancient wisdom directly to a modern problem the viewer faces TODAY.
- Every scene should make the viewer feel either PEACE, AWE, or HOPE.

HOOK PATTERNS for spiritual content:
  a) Transformation story: "She prayed every day for 21 days. Then this happened."
  b) Ancient wisdom reveal: "There is a verse in the Gita that answers your biggest fear."
  c) Miracle moment: Start with the miracle, then explain the devotion behind it.
  d) Modern problem, ancient answer: "Feeling lost? This is what Lord Krishna said about it."
${VIRALITY_STRUCTURE}
Always respond with valid JSON only. No markdown, no explanation.`;

function getBaseSystem(genre) {
  if (genre === 'sports') return SPORTS_SYSTEM;
  if (genre === 'religious') return RELIGIOUS_SYSTEM;
  return FINANCE_SYSTEM;
}

const GENRE_INSTRUCTIONS = {
  motivation: `Genre: MOTIVATIONAL FINANCE.
  Virality angle: Make them feel the GAP between where they are and where they could be.
  - Open with a shocking contrast: someone their age who made it vs. someone who didn't
  - Attack a limiting belief they hold as truth ("a stable job = financial security")
  - Deliver the mindset shift as a revelation, not a lecture
  - End with urgency: "the decision you make in the next 30 days will define the next 10 years"
  Title formula: "Why [common belief] is keeping you broke" / "The truth about [relatable struggle]"`,

  finance: `Genre: EDUCATIONAL FINANCE.
  Virality angle: Make them feel they are getting INSIDER knowledge the system hides from them.
  - Open with a specific number or fact that makes them say "wait, really?"
  - Frame the content as "what banks/employers/schools don't tell you"
  - Use the EXACT rupee amounts, exact percentages, exact timeframes
  - Every scene should add one new piece of information — never repeat
  Title formula: "The ₹X strategy nobody talks about" / "How [specific person] did [specific thing] in [time]"`,

  stories: `Genre: STORY-BASED WITH NAMED CHARACTERS.
  Virality angle: Make the viewer see THEMSELVES in the protagonist.

  CHARACTER RULES:
  - Introduce 2-3 named characters by scene 2 (e.g. Ramesh, Sunita, Priya)
  - Use N-[character_name] syntax to tag who is speaking/being narrated
    Example: N-[narrator] उसके पास सिर्फ ₹200 थे।
    Example: N-[ramesh] "मुझे नहीं पता कल क्या होगा।"
    Example: N-[sunita] "हम momo बनाएंगे।"
  - Use N-[narrator] for third-person storytelling lines
  - Each scene should have ONE N-[character] line — keep it one voice per scene
  - VISUAL RULE FOR CHARACTER SCENES: S- must describe the characters in the shot with their appearance and emotion.
    Example: S- Ramesh, tired Indian man 40s in worn kurta, sitting at dim table, head bowed, cracked room wall behind him, warm low light, illustration style

  STORY ARC:
  - Open with the protagonist at their lowest moment — specific detail, specific pain
  - The turning point must feel earned and real, not lucky
  - Weave in the lesson as a byproduct of the story, not the point of it
  - End with a transformation that feels achievable, not aspirational
  Title formula: "I [specific struggle] — here is what changed everything" / "From [low point] to [result]: the real story"`,

  sports: `Genre: SPORTS.
  Virality angle: Trigger the DEBATE impulse — make them want to share and argue.
  - Open at the peak dramatic moment, then build backward
  - Use stats and records that feel impossible ("only 3 drivers in 75 years have...")
  - Name the rivalry explicitly — nothing gets more shares than a GOAT debate
  - End with an open question or bold claim that begs a comment
  Title formula: "[Bold claim about athlete/team]" / "The [record/moment] that changed [sport] forever"`,

  religious: `Genre: SPIRITUAL/DEVOTIONAL.
  Virality angle: Give them a feeling of PEACE or HOPE they can't get anywhere else.
  - Open with a real human struggle ("feeling like everything is falling apart...")
  - Introduce the scriptural wisdom as the answer they didn't know they needed
  - Let the story breathe — devotional virality comes from emotional depth, not speed
  - End with a line that makes them want to save and share: "send this to someone who needs this today"
  Title formula: "What [deity/scripture] says about [modern problem]" / "The prayer that changed [specific situation]"`,
};

const SPORTS_TAGS = ['#f1', '#formula1', '#sports', '#shorts', '#cricket', '#f12025', '#sportsnews', '#racing', '#motorsport', '#viral'];
const RELIGIOUS_TAGS = ['#bhagavadgita', '#spiritual', '#devotional', '#hindu', '#shorts', '#faith', '#meditation', '#hanumanchalisa', '#godisgreat', '#viral'];
const FINANCE_TAGS = ['#personalfinance', '#moneytips', '#shorts', '#financetips', '#wealthbuilding', '#indianfinance', '#financialfreedom', '#moneymindset', '#investing', '#viral'];

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
- 9-11 scenes total — every scene must earn its place
- N- lines: max 12 words, one idea, maximum emotional punch
- Scene 1 is the HOOK — make it impossible to swipe past
- Total runtime: 30-45 seconds
- Pace: fast cuts, relentless forward momentum`
    : `Format: YouTube Video (16:9 landscape)
- 30-35 scenes total — quantity of cuts keeps retention high
- N- lines: 1-2 short sentences per scene (max 20 words)
- Scene 1 is still the HOOK — first 5 seconds decide if they stay
- Never let one image hold for more than 7 seconds
- Total runtime: 3-5 minutes
- Arc: Hook (3 scenes) → Pain (5 scenes) → Build (10 scenes) → Revelation (7 scenes) → Transformation + CTA (5 scenes)`;

  const genreNote = GENRE_INSTRUCTIONS[genre] || GENRE_INSTRUCTIONS.finance;
  const defaultTags = getDefaultTags(genre);

  const langNote = language === 'hi'
    ? `Language: HINDI (हिंदी)
- Write ALL N- lines in Hindi (Devanagari script). Example: "उसके पास सिर्फ ₹3,000 बचे थे।"
- Write S- lines in English (for image generation — English works better for AI image models).
- Titles, description, and tags should also be in Hindi with some English hashtags.
- Use conversational Hindi that young Indians actually speak — Hinglish is natural and preferred.`
    : `Language: English`;

  const baseSystem = getBaseSystem(genre);
  const systemPrompt = `${baseSystem}\n\n${genreNote}`;

  const userPrompt = `Write a maximum-virality YouTube script about: "${topic}"
Angle: ${angle || 'most viral possible'}
${formatNote}
${langNote}

TITLE RULES: All 3 title options must use different virality formulas:
  Option 1: Shock/controversy angle ("The [topic] truth nobody admits")
  Option 2: Curiosity gap ("Why [common thing] is actually [unexpected outcome]")
  Option 3: Specific result + person ("How [specific person type] [specific result] in [specific time]")

Return JSON only:
{
  "script": "S- [ultra-vivid cinematic image prompt]\\nN-[character] [max 12 words]\\n\\nS- ...\\nN-[character] ...\\n(Use N-[narrator] for voiceover, N-[name] for character dialogue. Stories genre MUST use character tags.)",
  "titleOptions": [
    "Shock/controversy title with emoji under 60 chars",
    "Curiosity gap title with emoji under 60 chars",
    "Specific result title with emoji under 60 chars"
  ],
  "suggestedTitle": "Bold 5-7 word overlay for first scene — makes them stop scrolling",
  "youtubeTitle": "The single most viral of the 3 titles (under 60 chars with emoji)",
  "description": "3 punchy lines: hook → value → CTA. End with hashtags.",
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
        max_tokens: 2000,
        temperature: 0.95,
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
