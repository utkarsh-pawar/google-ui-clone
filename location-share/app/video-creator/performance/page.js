'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getUploadHistory, refreshHistoryStats } from '@/lib/youtubeUtils';
import { analyzePerformance } from '@/lib/performanceAnalyzer';
import styles from './page.module.css';

export default function PerformancePage() {
  const [history, setHistory]     = useState([]);
  const [analysis, setAnalysis]   = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const h = getUploadHistory();
    setHistory(h);
    setAnalysis(analyzePerformance(h));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const enriched = await refreshHistoryStats('chants');
      setHistory(enriched);
      setAnalysis(analyzePerformance(enriched));
    } catch {}
    setRefreshing(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/video-creator/chants" className={styles.back}>← Back</Link>
        <div className={styles.title}>📊 Channel Performance</div>
        <button className={styles.refreshBtn} onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? '…' : '↻ Sync Stats'}
        </button>
      </header>

      {!analysis && (
        <div className={styles.empty}>
          Upload at least 2 videos to see AI performance insights. Sync Stats pulls real YouTube numbers.
        </div>
      )}

      {analysis && (
        <div className={styles.body}>
          {/* Deity ranking */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>🙏 Best Performing Deities</div>
            <div className={styles.rankList}>
              {analysis.deityRanking.map((d, i) => (
                <div key={d.deity} className={styles.rankRow}>
                  <span className={styles.rankNum}>{i + 1}</span>
                  <span className={styles.rankName}>{d.deity}</span>
                  <span className={styles.rankStat}>{d.avgViews.toLocaleString()} avg views</span>
                  <span className={styles.rankEng}>{d.engRate}% ♥</span>
                  <span className={styles.rankCount}>{d.count} videos</span>
                </div>
              ))}
            </div>
          </div>

          {/* Angle ranking */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>🎯 Best Content Angles</div>
            <div className={styles.rankList}>
              {analysis.angleRanking.map((a, i) => (
                <div key={a.angle} className={styles.rankRow}>
                  <span className={styles.rankNum}>{i + 1}</span>
                  <span className={styles.rankName}>{a.angle}</span>
                  <span className={styles.rankStat}>{a.avgViews.toLocaleString()} avg views</span>
                  <span className={styles.rankCount}>{a.count} videos</span>
                </div>
              ))}
            </div>
          </div>

          {/* Best & worst */}
          <div className={styles.highlights}>
            {analysis.best && (
              <div className={`${styles.highlightCard} ${styles.best}`}>
                <div className={styles.hlLabel}>🏆 Top Video</div>
                <div className={styles.hlTitle}>{analysis.best.title}</div>
                <div className={styles.hlStats}>
                  {analysis.best.stats?.views?.toLocaleString()} views · {analysis.best.deity} · {analysis.best.angle}
                </div>
                <a href={analysis.best.videoUrl} target="_blank" rel="noreferrer" className={styles.hlLink}>Watch →</a>
              </div>
            )}
            {analysis.worst && analysis.worst.videoId !== analysis.best?.videoId && (
              <div className={`${styles.highlightCard} ${styles.worst}`}>
                <div className={styles.hlLabel}>📉 Needs Work</div>
                <div className={styles.hlTitle}>{analysis.worst.title}</div>
                <div className={styles.hlStats}>
                  {analysis.worst.stats?.views?.toLocaleString()} views · {analysis.worst.deity} · {analysis.worst.angle}
                </div>
                <a href={analysis.worst.videoUrl} target="_blank" rel="noreferrer" className={styles.hlLink}>Watch →</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload history */}
      <div className={styles.historySection}>
        <div className={styles.cardTitle}>📋 Upload History ({history.length} videos)</div>
        <div className={styles.historyList}>
          {history.length === 0 && <div className={styles.empty}>No uploads yet.</div>}
          {history.map((entry, i) => (
            <div key={i} className={styles.historyRow}>
              <div className={styles.historyInfo}>
                <div className={styles.historyTitle}>{entry.title}</div>
                <div className={styles.historyMeta}>
                  {entry.deity && <span className={styles.tag}>{entry.deity}</span>}
                  {entry.angle && <span className={styles.tag}>{entry.angle}</span>}
                  <span className={styles.date}>{entry.uploadedAt ? new Date(entry.uploadedAt).toLocaleDateString() : ''}</span>
                </div>
              </div>
              <div className={styles.historyStats}>
                {entry.stats ? (
                  <>
                    <span className={styles.statViews}>{entry.stats.views?.toLocaleString() || 0} 👁</span>
                    <span className={styles.statLikes}>{entry.stats.likes || 0} ♥</span>
                  </>
                ) : (
                  <span className={styles.noStats}>No stats yet</span>
                )}
                {entry.videoUrl && (
                  <a href={entry.videoUrl} target="_blank" rel="noreferrer" className={styles.watchLink}>▶</a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
