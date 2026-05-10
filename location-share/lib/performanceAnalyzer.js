'use client';

// Turns upload history with YouTube stats into insights the AI can act on

export function analyzePerformance(history) {
  const withStats = history.filter(e => e.stats?.views > 0);
  if (withStats.length < 2) return null; // not enough data yet

  // Group by deity
  const byDeity = {};
  const byAngle = {};

  for (const entry of withStats) {
    const deity = entry.deity || 'unknown';
    const angle = entry.angle || 'unknown';
    const views = entry.stats.views || 0;
    const likes = entry.stats.likes || 0;
    const engRate = views > 0 ? ((likes / views) * 100).toFixed(1) : 0;

    if (!byDeity[deity]) byDeity[deity] = { total: 0, count: 0, likes: 0 };
    byDeity[deity].total += views;
    byDeity[deity].count += 1;
    byDeity[deity].likes += likes;

    if (!byAngle[angle]) byAngle[angle] = { total: 0, count: 0, likes: 0 };
    byAngle[angle].total += views;
    byAngle[angle].count += 1;
    byAngle[angle].likes += likes;
  }

  // Sort by avg views
  const deityRanking = Object.entries(byDeity)
    .map(([deity, d]) => ({ deity, avgViews: Math.round(d.total / d.count), count: d.count, engRate: d.count > 0 ? ((d.likes / d.total) * 100).toFixed(1) : 0 }))
    .sort((a, b) => b.avgViews - a.avgViews);

  const angleRanking = Object.entries(byAngle)
    .map(([angle, d]) => ({ angle, avgViews: Math.round(d.total / d.count), count: d.count }))
    .sort((a, b) => b.avgViews - a.avgViews);

  const best  = withStats.sort((a, b) => (b.stats.views || 0) - (a.stats.views || 0))[0];
  const worst = withStats.sort((a, b) => (a.stats.views || 0) - (b.stats.views || 0))[0];

  return { deityRanking, angleRanking, best, worst, totalVideos: withStats.length };
}

// Compact text summary the AI reads when deciding next video
export function buildPerformanceSummary(history) {
  const analysis = analyzePerformance(history);
  if (!analysis) return 'No performance data yet — not enough videos uploaded.';

  const { deityRanking, angleRanking, best, worst } = analysis;

  const deityLines = deityRanking.slice(0, 5)
    .map(d => `  ${d.deity}: avg ${d.avgViews.toLocaleString()} views (${d.count} videos, ${d.engRate}% engagement)`)
    .join('\n');

  const angleLines = angleRanking.slice(0, 4)
    .map(a => `  ${a.angle}: avg ${a.avgViews.toLocaleString()} views (${a.count} videos)`)
    .join('\n');

  return `CHANNEL PERFORMANCE DATA (${analysis.totalVideos} videos analysed):

TOP PERFORMING DEITIES:
${deityLines}

TOP PERFORMING CONTENT ANGLES:
${angleLines}

BEST VIDEO: "${best?.title}" — ${best?.stats?.views?.toLocaleString()} views (deity: ${best?.deity}, angle: ${best?.angle})
LOWEST VIDEO: "${worst?.title}" — ${worst?.stats?.views?.toLocaleString()} views (deity: ${worst?.deity}, angle: ${worst?.angle})

INSTRUCTIONS: Prioritise the top-performing deity and angle combinations above. Avoid repeating the lowest-performing patterns unless there is a strong festival reason. Your goal is to maximise views and watch time.`;
}
