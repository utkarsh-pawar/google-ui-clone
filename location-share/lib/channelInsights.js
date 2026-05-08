// Channel insights: upload history, performance scoring, topic bank
// "Simple things people like" — everyday frustrations, food/chai, family, money, tech rage, traffic

const INSIGHTS_KEY_PREFIX = 'channel-insights-';

// ── Topic Bank ────────────────────────────────────────────────────────────────
// Curated seed topics proven to drive virality on Shorts: relatable everyday pain.
export const TOPIC_BANK = {
  general: [
    { topic: 'Why every Indian restaurant says "2 minutes" for 20 minutes', tags: ['#relatable', '#food', '#india'] },
    { topic: 'That moment when WiFi drops during a movie climax', tags: ['#wifi', '#struggle', '#relatable'] },
    { topic: 'Auto drivers who "don\'t have change" but always do', tags: ['#auto', '#india', '#funny'] },
    { topic: 'Why alarm clocks are lies we tell ourselves', tags: ['#morning', '#sleep', '#relatable'] },
    { topic: 'Chai getting cold exactly when you sit down', tags: ['#chai', '#india', '#mood'] },
    { topic: 'Every phone notification during focus work', tags: ['#focus', '#distraction', '#worklife'] },
    { topic: 'Google Maps recalculating after every correct turn', tags: ['#googlemaps', '#navigation', '#tech'] },
    { topic: 'Why "5 more minutes" of sleep is a different universe', tags: ['#sleep', '#morning', '#relatable'] },
    { topic: 'That one relative who asks about marriage at every family gathering', tags: ['#family', '#india', '#marriage'] },
    { topic: 'Parking at a mall: a survival guide', tags: ['#parking', '#mall', '#india'] },
  ],
  comedy: [
    { topic: 'Halku vs cold chai: an epic battle', tags: ['#halku', '#chai', '#comedy'] },
    { topic: 'Halku tries to book IRCTC tickets at 10AM', tags: ['#halku', '#irctc', '#comedy'] },
    { topic: 'Halku vs the neighbour\'s wedding DJ at midnight', tags: ['#halku', '#wedding', '#comedy'] },
    { topic: 'Halku waits at the government office for 3 hours', tags: ['#halku', '#government', '#comedy'] },
    { topic: 'Halku\'s WiFi dies during IPL final', tags: ['#halku', '#ipl', '#cricket', '#comedy'] },
    { topic: 'Halku assembles IKEA furniture alone', tags: ['#halku', '#ikea', '#comedy'] },
    { topic: 'Halku\'s doctor says "come back next week"', tags: ['#halku', '#doctor', '#comedy'] },
    { topic: 'Halku vs Google Maps recalculating in 1-way street', tags: ['#halku', '#googlemaps', '#comedy'] },
    { topic: 'Halku makes Maggi but runs out of masala', tags: ['#halku', '#maggi', '#comedy'] },
    { topic: 'Halku fights with auto driver over ₹10', tags: ['#halku', '#auto', '#comedy'] },
  ],
  finance: [
    { topic: 'How ₹100 became ₹2000 in 5 years (and how to do it)', tags: ['#investing', '#finance', '#money'] },
    { topic: 'Why Indians keep money under the mattress (and why to stop)', tags: ['#finance', '#savings', '#india'] },
    { topic: 'The real cost of eating out every day vs cooking at home', tags: ['#budget', '#food', '#finance'] },
    { topic: 'SIP: the most boring thing that will make you rich', tags: ['#sip', '#mutualfunds', '#investing'] },
    { topic: 'What happens to your money in a savings account vs FD', tags: ['#fd', '#savings', '#banking'] },
  ],
  sports: [
    { topic: 'How Virat Kohli trains his mind before a big match', tags: ['#virat', '#cricket', '#sports'] },
    { topic: 'The science of why Federer\'s backhand is impossible to copy', tags: ['#tennis', '#federer', '#sports'] },
    { topic: 'Why India always wins in cricket but struggles in football', tags: ['#india', '#cricket', '#football'] },
    { topic: 'The real reason athletes ice-bath every day', tags: ['#recovery', '#sports', '#athlete'] },
    { topic: 'Chess vs sports: which needs more mental strength?', tags: ['#chess', '#sports', '#mindset'] },
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
