export const maxDuration = 30;
export const runtime = 'nodejs';

// Static curated topics for spiritual genres — shown in both Hindi + English.
// Skips the LLM call entirely since Cerebras/Llama corrupts Devanagari.
const SPIRITUAL_TOPICS = {
  chants: [
    { topic: 'यदा यदा हि धर्मस्य — गीता का वो श्लोक जो आज भी सच है', angle: 'ancient-wisdom', hook: 'This Gita verse answers the question you\'ve been afraid to ask.', whyTrending: 'Bhagavad Gita content getting massive saves on Shorts' },
    { topic: 'हनुमान चालीसा की वो पंक्ति जो डर दूर करती है', angle: 'devotional', hook: 'One line from Hanuman Chalisa that removes fear instantly.', whyTrending: 'Loneliness epidemic driving people to devotional content' },
    { topic: 'गायत्री मंत्र का असली अर्थ — जो कोई नहीं बताता', angle: 'revelation', hook: 'You\'ve heard it a thousand times. But do you know what it means?', whyTrending: 'Mantra meaning searches spiking before festival season' },
    { topic: 'ॐ नमः शिवाय — इस मंत्र की शक्ति क्या है?', angle: 'spiritual-awakening', hook: 'Why millions chant this every morning — the science behind it.', whyTrending: 'Shiva content trending heavily across Indian Shorts' },
    { topic: 'महामृत्युंजय मंत्र — क्यों पढ़ते हैं और क्या होता है', angle: 'ancient-wisdom', hook: 'The most powerful healing mantra in the Vedas. Here\'s why.', whyTrending: 'Healing and wellness content at all-time high engagement' },
    { topic: 'जब श्रीकृष्ण ने कहा — कर्म करो, फल की चिंता मत करो', angle: 'transformation', hook: 'The one teaching that changes how you see work forever.', whyTrending: 'Work stress and burnout driving Gita content virality' },
    { topic: 'रामायण की वो सीख जो जीवन बदल देती है', angle: 'ancient-wisdom', hook: 'Ram\'s one decision that every modern person needs to hear.', whyTrending: 'Ram Navami season boosting Ramayan content reach' },
    { topic: 'सुंदरकांड — क्यों पढ़ते हैं और क्या बदलता है', angle: 'devotional', hook: 'Millions read this every Tuesday. Here\'s what actually happens.', whyTrending: 'Sundarkand trending on every devotional channel' },
    { topic: 'गीता अध्याय 2 — मृत्यु का डर खत्म करने वाला सत्य', angle: 'revelation', hook: 'Chapter 2 of the Gita has the answer to your deepest fear.', whyTrending: 'Existential anxiety content resonating deeply in 2026' },
    { topic: 'कर्म का नियम — जो बोओगे वही काटोगे', angle: 'ancient-wisdom', hook: 'The Gita\'s law of karma explained in 60 seconds.', whyTrending: 'Karma concept getting millions of views globally' },
  ],
  wisdom: [
    { topic: 'जो लोग कम बोलते हैं, वो ज़्यादा जीतते हैं', angle: 'self-improvement', hook: 'Silence is the most underrated superpower.', whyTrending: 'Stoicism and silence content dominating Hindi Shorts' },
    { topic: 'सुबह की पहली 5 मिनट — ज़िंदगी बदलने वाली आदत', angle: 'transformation', hook: 'What you do in the first 5 minutes decides your entire day.', whyTrending: 'Morning routine content performing strongly in 2026' },
    { topic: 'दर्द वो नहीं जो लोग देते हैं — दर्द वो है जो खुद को', angle: 'emotional', hook: 'Your worst enemy lives inside your own head.', whyTrending: 'Mental health wisdom trending across Hindi channels' },
    { topic: 'अकेलापन कमज़ोरी नहीं — सबसे बड़ी ताकत है', angle: 'self-improvement', hook: 'Being alone is not the same as being lonely.', whyTrending: 'Loneliness epidemic making solitude content go viral' },
    { topic: 'माफ़ करना कमज़ोरी नहीं — यह सबसे बड़ी ताकत है', angle: 'emotional', hook: 'The person who forgives wins every time.', whyTrending: 'Forgiveness and emotional healing content spiking' },
    { topic: 'तुम्हारी सबसे बड़ी गलती — दूसरों की राय से डरना', angle: 'self-improvement', hook: 'You are living someone else\'s life. Here\'s how to stop.', whyTrending: 'People-pleasing content resonating with Indian youth' },
    { topic: 'जो वक्त पर जागते हैं, वो वक्त बनाते हैं', angle: 'discipline', hook: 'Time doesn\'t wait. But most people act like it does.', whyTrending: 'Discipline content dominating morning motivation niche' },
    { topic: 'असली ताकत वो है जो दिखती नहीं', angle: 'self-improvement', hook: 'The strongest people you know never show their strength.', whyTrending: 'Quiet strength and resilience content growing fast' },
  ],
  chanakya: [
    { topic: 'चाणक्य: जो दूसरों की गलतियों से सीखे, वो कभी नहीं हारता', angle: 'ancient-wisdom', hook: 'Chanakya said this 2300 years ago. It\'s more true today.', whyTrending: 'Chanakya niti content exploding on Indian Shorts' },
    { topic: 'चाणक्य नीति: अपना रहस्य किसी को मत बताओ', angle: 'ancient-wisdom', hook: 'The one rule Chanakya said separates winners from losers.', whyTrending: 'WhatsApp sharing of Chanakya quotes at all-time high' },
    { topic: 'चाणक्य: असली दोस्त की पहचान — मुश्किल वक्त में', angle: 'revelation', hook: 'You\'ll know who your real friends are when this happens.', whyTrending: 'Friendship and betrayal content always viral' },
    { topic: 'चाणक्य नीति: पैसा कैसे बचाएं — 2300 साल पुरानी सलाह', angle: 'ancient-wisdom', hook: 'The oldest money advice in India. Still the best.', whyTrending: 'Finance + ancient wisdom crossover content trending' },
    { topic: 'चाणक्य: गुस्से में फैसला करने वाला हमेशा हारता है', angle: 'self-improvement', hook: 'Every bad decision you\'ve made started with anger.', whyTrending: 'Emotional regulation content getting massive engagement' },
    { topic: 'चाणक्य: इन 3 लोगों पर कभी भरोसा मत करो', angle: 'revelation', hook: 'Chanakya identified 3 types of people 23 centuries ago.', whyTrending: 'Trust and betrayal content always resonates deeply' },
    { topic: 'चाणक्य नीति: सफलता का राज़ — लक्ष्य किसी को मत बताओ', angle: 'ancient-wisdom', hook: 'Stop telling people your goals. Chanakya explains why.', whyTrending: 'Goal-setting psychology content trending among students' },
    { topic: 'चाणक्य: शत्रु को कभी कमज़ोर मत समझो', angle: 'ancient-wisdom', hook: 'The mistake that has destroyed more plans than any other.', whyTrending: 'Strategy and competition content high among young Indians' },
  ],
};

function getSpiritualIdeas(genre) {
  const pool = SPIRITUAL_TOPICS[genre] || SPIRITUAL_TOPICS.chants;
  // Shuffle and return 10
  return [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
}

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

const CHANTS_TRENDS = `
You are a viral spiritual content researcher for a Hindi chants and wisdom channel targeting Indian audiences in May 2026:
- Bhagavad Gita shlokas that are trending on Instagram Reels and YouTube Shorts
- Hanuman Chalisa, Gayatri Mantra, Mahamrityunjaya Mantra — lines people are searching their meaning for
- Chanakya niti quotes going viral on WhatsApp and Twitter
- Modern problems (job stress, loneliness, family pressure, money anxiety) that ancient wisdom addresses
- Upcoming Hindu festivals in the next 30 days — content people search before the festival
- Sanskrit shlokas whose Hindi meanings are surprising or deeply moving
- Morning motivation content in Hindi that is getting massive saves and shares
- Kabir dohas, Rahim dohas that are resonating with young Indians
`;

const COMEDY_TRENDS = `
You are a viral comedy content researcher for a Hindi comedy Shorts channel targeting Indians (16-35) in May 2026:
- Everyday Indian frustrations going viral: auto drivers, IRCTC, cold chai, government offices, slow WiFi
- Relatable family situations: relatives asking about marriage/job, parents vs technology, joint family chaos
- Current events that can be made funny: IPL drama, election season quirks, price hikes
- Recurring character skits — introduce a character with ONE defining flaw in a new situation
- "POV:" formats and "When X happens" formats that make people tag friends
- Desi workplace humor: office politics, WFH struggles, boss behavior
- Food frustrations: Zomato delays, restaurant "2 minutes", Maggi situations
- Traffic, parking, and commute comedy that every Indian relates to
`;

function getTrendContext(genre) {
  if (genre === 'sports')  return SPORTS_TRENDS;
  if (genre === 'religious') return RELIGIOUS_TRENDS;
  if (genre === 'comedy')  return COMEDY_TRENDS;
  if (['chants', 'wisdom', 'chanakya'].includes(genre)) return CHANTS_TRENDS;
  return FINANCE_TRENDS;
}

const GENRE_INSTRUCTIONS = {
  motivation: 'Focus on: mindset shifts, wake-up calls, hard truths about money and ambition that are spreading virally.',
  finance:    'Focus on: specific numbers, "secrets" banks hide, investment strategies getting attention, money mistakes going viral.',
  stories:    'Focus on: real-feeling transformation stories, specific people with specific journeys that feel authentic and relatable.',
  sports:     'Focus on: peak drama, records, rivalries, moments that make fans want to debate and share.',
  religious:  'Focus on: emotional resonance, ancient wisdom solving modern problems, miracle/transformation angles that make people save and share.',
  comedy:     'Focus on: relatable everyday Indian frustrations, character skits with one defining flaw, "tag a friend" moments, situations every Indian has faced. Topics should feel instantly recognisable.',
  chants:     'Focus on: specific shlokas or chants whose meaning surprises people, mantras trending before festivals, devotional lines that give peace. Write titles in English describing the shloka topic.',
  wisdom:     'Focus on: short wisdom truths that hit hard, morning motivation, life lessons that feel profound. Write titles in English.',
  chanakya:   'Focus on: Chanakya niti quotes shockingly relevant today, practical life lessons, quotes going viral. Write titles in English.',
};

export async function POST(request) {
  const { genre = 'finance', channelId = 'general', language = 'en' } = await request.json();

  // Spiritual genres: return curated bilingual topics (Hindi + English) directly.
  // Skips the LLM call — Cerebras/Llama cannot write Devanagari reliably.
  if (['chants', 'wisdom', 'chanakya'].includes(genre)) {
    return Response.json({ ideas: getSpiritualIdeas(genre) });
  }

  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) return Response.json({ error: 'CEREBRAS_API_KEY not set' }, { status: 500 });

  const trendContext = getTrendContext(genre);
  const genreInstruction = GENRE_INSTRUCTIONS[genre] || GENRE_INSTRUCTIONS.finance;
  const isHindiGenre = ['chants', 'wisdom', 'chanakya'].includes(genre);
  // Llama cannot output Devanagari reliably — use Roman-script Hindi (Hinglish) instead.
  // e.g. "Hanuman Chalisa ki vo line jo dar door karta hai" — sounds Hindi, renders fine.
  const langNote = (language === 'hi' || isHindiGenre)
    ? 'Write topic titles in Roman-script Hindi (Hinglish transliteration) — NOT Devanagari, NOT English. Example: "Bhagavad Gita ka vo shlok jo aapka dard khatam kar dega". Keep hook and whyTrending in English.'
    : '';

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
