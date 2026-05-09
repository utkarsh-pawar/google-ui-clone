// Channel insights: upload history, performance scoring, topic bank
// "Simple things people like" — everyday frustrations, food/chai, family, money, tech rage, traffic

const INSIGHTS_KEY_PREFIX = 'channel-insights-';

// ── Topic Bank ────────────────────────────────────────────────────────────────
// Curated seed topics proven to drive virality on Shorts: relatable everyday pain.
// Each entry: { topic, angle, tags }
// angle maps to the generate-script API's "angle" field
export const TOPIC_BANK = {
  general: [
    { topic: 'The untold history of chai — how a British plot became India\'s soul drink', angle: 'history', tags: ['#chai', '#history', '#india', '#shorts'] },
    { topic: 'Why auto-rickshaws have 3 wheels — the Italian secret behind India\'s king of roads', angle: 'history', tags: ['#auto', '#history', '#india', '#shorts'] },
    { topic: 'The real story of how Maggi survived a ban and came back stronger', angle: 'history', tags: ['#maggi', '#history', '#food', '#shorts'] },
    { topic: 'How the humble dabba became a billion-dollar logistics miracle', angle: 'history', tags: ['#dabbawala', '#mumbai', '#history', '#shorts'] },
    { topic: 'The origin of Jugaad — how Indians invented the world\'s most efficient word', angle: 'history', tags: ['#jugaad', '#india', '#innovation', '#shorts'] },
    { topic: 'How IRCTC went from a broken website to booking 1 million tickets a day', angle: 'history', tags: ['#irctc', '#history', '#trains', '#shorts'] },
    { topic: 'The story of how "namaste" conquered the world', angle: 'history', tags: ['#namaste', '#culture', '#india', '#shorts'] },
    { topic: 'Why the alarm clock was invented — and the man who regretted it', angle: 'history', tags: ['#alarm', '#history', '#facts', '#shorts'] },
    { topic: 'How WiFi was accidentally discovered by an Australian astronomer', angle: 'history', tags: ['#wifi', '#history', '#tech', '#shorts'] },
    { topic: 'The origin of tiffin boxes — how a simple tin changed how the world eats lunch', angle: 'history', tags: ['#tiffin', '#history', '#food', '#india', '#shorts'] },
  ],
  comedy: [
    { topic: 'Halku discovers the ancient history of cold chai — and declares war', angle: 'comedy', tags: ['#halku', '#chai', '#comedy', '#shorts'] },
    { topic: 'Halku tries to understand why IRCTC was built the way it was — and explodes', angle: 'comedy', tags: ['#halku', '#irctc', '#comedy', '#shorts'] },
    { topic: 'Halku learns the history of alarm clocks and hunts down the inventor', angle: 'comedy', tags: ['#halku', '#alarm', '#comedy', '#shorts'] },
    { topic: 'Halku vs the origin story of auto-rickshaws: "3 wheels is CHEATING"', angle: 'comedy', tags: ['#halku', '#auto', '#comedy', '#shorts'] },
    { topic: 'Halku finds out Maggi was almost banned forever — and has a breakdown', angle: 'comedy', tags: ['#halku', '#maggi', '#comedy', '#shorts'] },
    { topic: 'Halku discovers WiFi was an accident and demands a refund from Australia', angle: 'comedy', tags: ['#halku', '#wifi', '#comedy', '#shorts'] },
    { topic: 'Halku learns the history of traffic lights and tries to sue the inventor', angle: 'comedy', tags: ['#halku', '#traffic', '#comedy', '#shorts'] },
    { topic: 'Halku finds out Jugaad is in the Oxford dictionary — and loses his mind', angle: 'comedy', tags: ['#halku', '#jugaad', '#comedy', '#shorts'] },
    { topic: 'Halku discovers elevators were invented before the safety brake — refuses to board', angle: 'comedy', tags: ['#halku', '#elevator', '#history', '#comedy', '#shorts'] },
    { topic: 'Halku learns the first alarm was a Greek water clock — builds one and floods his kitchen', angle: 'comedy', tags: ['#halku', '#alarm', '#comedy', '#shorts'] },
  ],
  finance: [
    { topic: 'The 5000-year history of money — from cows to crypto', angle: 'history', tags: ['#money', '#history', '#finance', '#shorts'] },
    { topic: 'How the EMI was invented — and why banks love it more than you do', angle: 'history', tags: ['#emi', '#finance', '#loans', '#shorts'] },
    { topic: 'The origin of the stock market — how a Dutch spice trade changed the world', angle: 'history', tags: ['#stocks', '#history', '#investing', '#shorts'] },
    { topic: 'How SIP was invented — and why Indians ignored it for 20 years', angle: 'history', tags: ['#sip', '#mutualfunds', '#history', '#shorts'] },
    { topic: 'The real history of credit cards — invented by a man who forgot his wallet', angle: 'history', tags: ['#creditcard', '#finance', '#history', '#shorts'] },
  ],
  chants: [
    { topic: 'यदा यदा हि धर्मस्य — गीता का वो श्लोक जो आज भी सच है', angle: 'history', tags: ['#bhagavadgita', '#gita', '#shorts', '#spiritual', '#hindi'] },
    { topic: 'हनुमान चालीसा की वो पंक्ति जो डर दूर कर देती है', angle: 'history', tags: ['#hanumanchalisa', '#hanuman', '#shorts', '#spiritual', '#hindi'] },
    { topic: 'गायत्री मंत्र का असली अर्थ — जो कोई नहीं बताता', angle: 'history', tags: ['#gayatrimantra', '#mantra', '#shorts', '#spiritual', '#hindi'] },
    { topic: 'जब श्रीकृष्ण ने अर्जुन से कहा — कर्म करो, फल की चिंता मत करो', angle: 'history', tags: ['#gita', '#krishna', '#shorts', '#karma', '#hindi'] },
    { topic: 'महामृत्युंजय मंत्र — क्यों पढ़ते हैं और क्या होता है', angle: 'history', tags: ['#mahamrityunjaya', '#shiva', '#mantra', '#shorts', '#hindi'] },
    { topic: 'ॐ नमः शिवाय — इस मंत्र की शक्ति क्या है?', angle: 'history', tags: ['#omnamahshivaya', '#shiva', '#mantra', '#shorts', '#hindi'] },
    { topic: 'रामायण की वो सीख जो जीवन बदल देती है', angle: 'wisdom', tags: ['#ramayan', '#ram', '#shorts', '#spiritual', '#hindi'] },
    { topic: 'भगवद गीता — अध्याय 2 का वो सत्य जो मृत्यु का डर खत्म करता है', angle: 'history', tags: ['#gita', '#bhagavadgita', '#shorts', '#spiritual', '#hindi'] },
    { topic: 'सुंदरकांड क्यों पढ़ते हैं — वैज्ञानिक और आध्यात्मिक कारण', angle: 'history', tags: ['#sundarkand', '#hanuman', '#shorts', '#spiritual', '#hindi'] },
    { topic: 'कर्म का नियम — जो बोओगे वही काटोगे: गीता का सबक', angle: 'wisdom', tags: ['#karma', '#gita', '#shorts', '#spiritual', '#hindi'] },
  ],
  wisdom: [
    { topic: 'जो लोग कम बोलते हैं, वो ज़्यादा जीतते हैं', angle: 'wisdom', tags: ['#hindimotivation', '#wisdom', '#shorts', '#motivation', '#hindi'] },
    { topic: 'सुबह की पहली 5 मिनट — ज़िंदगी बदलने वाली आदत', angle: 'wisdom', tags: ['#morning', '#motivation', '#shorts', '#hindi', '#wisdom'] },
    { topic: 'जो तुम्हारे बारे में बात करते हैं — उनसे डरो नहीं', angle: 'wisdom', tags: ['#motivation', '#hindi', '#shorts', '#wisdom', '#life'] },
    { topic: 'दर्द वो नहीं जो लोग देते हैं — दर्द वो है जो तुम खुद को देते हो', angle: 'wisdom', tags: ['#hindimotivation', '#shorts', '#life', '#wisdom', '#hindi'] },
    { topic: 'अकेलापन कमज़ोरी नहीं, सबसे बड़ी ताकत है', angle: 'wisdom', tags: ['#motivation', '#hindi', '#shorts', '#mindset', '#wisdom'] },
    { topic: 'जो वक्त पर जागते हैं, वो वक्त बनाते हैं', angle: 'wisdom', tags: ['#morning', '#discipline', '#shorts', '#hindi', '#motivation'] },
    { topic: 'माफ़ करना कमज़ोरी नहीं — यह सबसे बड़ी ताकत है', angle: 'wisdom', tags: ['#forgiveness', '#hindi', '#shorts', '#wisdom', '#life'] },
    { topic: 'तुम्हारी सबसे बड़ी गलती — दूसरों की राय से डरना', angle: 'wisdom', tags: ['#confidence', '#hindi', '#shorts', '#motivation', '#wisdom'] },
  ],
  chanakya: [
    { topic: 'चाणक्य: जो दूसरों की गलतियों से सीखे, वो कभी नहीं हारता', angle: 'chanakya', tags: ['#chanakyaniti', '#chanakya', '#shorts', '#wisdom', '#hindi'] },
    { topic: 'चाणक्य नीति: अपना रहस्य किसी को मत बताओ', angle: 'chanakya', tags: ['#chanakyaniti', '#shorts', '#chanakya', '#life', '#hindi'] },
    { topic: 'चाणक्य: असली दोस्त की पहचान — मुश्किल वक्त में', angle: 'chanakya', tags: ['#chanakyaniti', '#friendship', '#shorts', '#chanakya', '#hindi'] },
    { topic: 'चाणक्य नीति: पैसा कैसे बचाएं — 2300 साल पुरानी सलाह', angle: 'chanakya', tags: ['#chanakyaniti', '#money', '#shorts', '#chanakya', '#hindi'] },
    { topic: 'चाणक्य: शत्रु को कभी कमज़ोर मत समझो', angle: 'chanakya', tags: ['#chanakyaniti', '#chanakya', '#shorts', '#wisdom', '#hindi'] },
    { topic: 'चाणक्य नीति: जो गुस्से में फैसला करता है, वो हमेशा हारता है', angle: 'chanakya', tags: ['#chanakyaniti', '#anger', '#shorts', '#chanakya', '#hindi'] },
    { topic: 'चाणक्य: सफलता का राज़ — कभी अपना लक्ष्य किसी को मत बताओ', angle: 'chanakya', tags: ['#chanakyaniti', '#success', '#shorts', '#chanakya', '#hindi'] },
    { topic: 'चाणक्य नीति: इन 3 लोगों पर कभी भरोसा मत करो', angle: 'chanakya', tags: ['#chanakyaniti', '#trust', '#shorts', '#chanakya', '#hindi'] },
  ],
  sports: [
    { topic: 'How cricket went from a children\'s game in England to India\'s religion', angle: 'history', tags: ['#cricket', '#history', '#india', '#shorts'] },
    { topic: 'The origin of the IPL — one man\'s deal that changed cricket forever', angle: 'history', tags: ['#ipl', '#cricket', '#history', '#shorts'] },
    { topic: 'How chess was invented in India and conquered the world', angle: 'history', tags: ['#chess', '#history', '#india', '#shorts'] },
    { topic: 'The real reason the Olympics were revived in 1896 — and almost cancelled', angle: 'history', tags: ['#olympics', '#history', '#sports', '#shorts'] },
    { topic: 'How Kabaddi went from village mud to a Prime Video global league', angle: 'history', tags: ['#kabaddi', '#history', '#sports', '#shorts'] },
  ],
};

export function getTopicsForChannel(channelId) {
  return TOPIC_BANK[channelId] || TOPIC_BANK.general;
}

// ── Upload History ────────────────────────────────────────────────────────────

export function loadInsights(channelId) {
  if (typeof window === 'undefined') return { uploads: [], score: null };
  try {
    return JSON.parse(localStorage.getItem(INSIGHTS_KEY_PREFIX + channelId) || '{"uploads":[]}');
  } catch {
    return { uploads: [] };
  }
}

export function saveInsights(channelId, data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INSIGHTS_KEY_PREFIX + channelId, JSON.stringify(data));
  } catch {}
}

export function recordUpload(channelId, entry) {
  const data = loadInsights(channelId);
  const uploads = [{ ...entry, uploadedAt: new Date().toISOString() }, ...(data.uploads || [])];
  saveInsights(channelId, { ...data, uploads: uploads.slice(0, 100) });
}

// ── Performance Scoring ───────────────────────────────────────────────────────
// Scores are pulled from YouTube Analytics if available, else estimated from
// metadata heuristics (title length, tag count, description keywords).

export function scoreUpload(entry) {
  let score = 50; // baseline
  const title = entry.title || '';
  const tags = entry.tags || [];

  // Title hooks (+15 for question, +10 for number, +5 for "vs")
  if (/\?/.test(title)) score += 15;
  if (/\d+/.test(title)) score += 10;
  if (/\bvs\b/i.test(title)) score += 8;
  if (title.length >= 30 && title.length <= 70) score += 5; // optimal length

  // Tag quality (+2 per relevant tag, up to +20)
  const viralKeywords = ['relatable', 'funny', 'india', 'shorts', 'viral', 'comedy', 'chai', 'daily'];
  const matchedTags = tags.filter(t => viralKeywords.some(k => t.toLowerCase().includes(k)));
  score += Math.min(matchedTags.length * 2, 20);

  // Views bonus if known
  if (entry.views) {
    if (entry.views > 100000) score += 30;
    else if (entry.views > 10000) score += 20;
    else if (entry.views > 1000) score += 10;
  }

  return Math.min(score, 100);
}

// Returns top-performing genres/topics from upload history
export function getInsightsSummary(channelId) {
  const { uploads } = loadInsights(channelId);
  if (!uploads.length) return { topGenres: [], topTopics: [], avgScore: 0, totalUploads: 0 };

  const genreCount = {};
  const topicScores = {};
  let totalScore = 0;

  for (const u of uploads) {
    const genre = u.genre || 'general';
    genreCount[genre] = (genreCount[genre] || 0) + 1;

    const score = scoreUpload(u);
    totalScore += score;

    const topic = u.topic || u.title || 'unknown';
    if (!topicScores[topic]) topicScores[topic] = [];
    topicScores[topic].push(score);
  }

  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre, count]) => ({ genre, count }));

  const topTopics = Object.entries(topicScores)
    .map(([topic, scores]) => ({ topic, avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5);

  return {
    topGenres,
    topTopics,
    avgScore: Math.round(totalScore / uploads.length),
    totalUploads: uploads.length,
  };
}
