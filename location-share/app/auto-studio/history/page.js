'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getUploadHistory, refreshHistoryStats } from '@/lib/youtubeUtils';
import { isYouTubeConnected } from '@/lib/youtubeUtils';
import styles from './page.module.css';

function buildStats(history) {
  const byDeity = {}, byAngle = {};
  let totalViews = 0, totalLikes = 0, withStats = 0;

  for (const h of history) {
    const v = h.stats?.views || 0;
    const l = h.stats?.likes || 0;
    totalViews += v; totalLikes += l;
    if (v > 0) withStats++;

    if (h.deity) {
      byDeity[h.deity] = byDeity[h.deity] || { views: 0, likes: 0, n: 0 };
      byDeity[h.deity].views += v; byDeity[h.deity].likes += l; byDeity[h.deity].n++;
    }
    if (h.angle) {
      byAngle[h.angle] = byAngle[h.angle] || { views: 0, n: 0 };
      byAngle[h.angle].views += v; byAngle[h.angle].n++;
    }
  }

  const deityRank = Object.entries(byDeity)
    .map(([d, s]) => ({ d, avg: s.n ? Math.round(s.views / s.n) : 0, total: s.views, n: s.n }))
    .sort((a, b) => b.avg - a.avg);

  const angleRank = Object.entries(byAngle)
    .map(([a, s]) => ({ a, avg: s.n ? Math.round(s.views / s.n) : 0, n: s.n }))
    .sort((a, b) => b.avg - a.avg);

  const best  = [...history].filter(h => h.stats?.views > 0).sort((a, b) => (b.stats.views || 0) - (a.stats.views || 0))[0] || null;

  return { deityRank, angleRank, totalViews, totalLikes, withStats, best, totalVideos: history.length };
}

function buildLearning(deityRank, angleRank) {
  if (deityRank.length === 0) return null;
  const top = deityRank[0];
  const topAngle = angleRank[0];
  const lines = [
    `🏆 ${top.d} content is your top performer at ${top.avg.toLocaleString()} avg views — the system prioritizes this deity's angle selection.`,
    topAngle ? `🎯 "${topAngle.a}" style resonates most — script generation biases toward this angle type.` : null,
    deityRank.length > 2 ? `📊 Based on ${deityRank.reduce((s, r) => s + r.n, 0)} tracked videos — the more videos you publish, the smarter the recommendations get.` : null,
  ].filter(Boolean);
  return lines;
}

export default function V2HistoryPage() {
  const [history, setHistory] = useState([]);
  const [stats, setStats]     = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [ytConn, setYtConn]   = useState(false);
  const [learning, setLearning] = useState(null);

  useEffect(() => {
    const h = getUploadHistory();
    setHistory(h);
    const s = buildStats(h);
    setStats(s);
    setLearning(buildLearning(s.deityRank, s.angleRank));
    setYtConn(isYouTubeConnected('chants'));
  }, []);

  const syncStats = useCallback(async () => {
    setSyncing(true);
    try {
      const enriched = await refreshHistoryStats('chants');
      setHistory(enriched);
      const s = buildStats(enriched);
      setStats(s);
      setLearning(buildLearning(s.deityRank, s.angleRank));
    } catch (e) {
      console.warn('Sync failed', e);
    } finally {
      setSyncing(false);
    }
  }, []);

  if (!stats) return <div className={styles.loading}>Loading…</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/auto-studio" className={styles.back}>← Auto Studio</Link>
        <div className={styles.headerTitle}>📊 History & Learnings</div>
        <button
          className={styles.syncBtn}
          onClick={syncStats}
          disabled={syncing || !ytConn}
          title={!ytConn ? 'Connect YouTube to sync real stats' : 'Fetch latest views/likes from YouTube'}
        >
          {syncing ? <><span className={styles.btnSpin} /> Syncing…</> : '↻ Sync Stats'}
        </button>
      </header>

      <div className={styles.body}>

        {/* Summary numbers */}
        <div className={styles.summaryGrid}>
          {[
            { label: 'Total Videos',    val: stats.totalVideos },
            { label: 'With Stats',       val: stats.withStats },
            { label: 'Total Views',      val: stats.totalViews.toLocaleString() },
            { label: 'Total Likes',      val: stats.totalLikes.toLocaleString() },
          ].map(({ label, val }) => (
            <div key={label} className={styles.summaryCard}>
              <div className={styles.summaryVal}>{val}</div>
              <div className={styles.summaryLabel}>{label}</div>
            </div>
          ))}
        </div>

        {/* AI Learnings */}
        {learning && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>🤖 What the System Has Learned</div>
            <div className={styles.learnList}>
              {learning.map((l, i) => <div key={i} className={styles.learnLine}>{l}</div>)}
            </div>
            {!ytConn && <div className={styles.learnNote}>Connect YouTube and sync stats to unlock richer learnings.</div>}
          </div>
        )}

        {/* Deity ranking */}
        {stats.deityRank.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>🏆 Deity Performance</div>
            <div className={styles.rankList}>
              {stats.deityRank.map((r, i) => (
                <div key={r.d} className={styles.rankRow}>
                  <span className={styles.rankPos}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                  <span className={styles.rankName}>{r.d}</span>
                  <div className={styles.rankBar}>
                    <div className={styles.rankFill} style={{ width: `${stats.deityRank[0].avg > 0 ? (r.avg / stats.deityRank[0].avg) * 100 : 0}%` }} />
                  </div>
                  <span className={styles.rankStat}>{r.avg.toLocaleString()} avg · {r.n} vid{r.n !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Angle ranking */}
        {stats.angleRank.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>🎯 Best Content Angles</div>
            <div className={styles.angleList}>
              {stats.angleRank.map((r, i) => (
                <div key={r.a} className={styles.angleRow}>
                  <span className={styles.anglePos}>#{i + 1}</span>
                  <span className={styles.angleName}>{r.a}</span>
                  <span className={styles.angleStat}>{r.avg.toLocaleString()} avg views · {r.n} video{r.n !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Best video */}
        {stats.best && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>⭐ Best Performing Video</div>
            <div className={styles.bestCard}>
              <div className={styles.bestTitle}>{stats.best.title || stats.best.topic || '—'}</div>
              <div className={styles.bestTags}>
                {stats.best.deity && <span className={styles.tag}>{stats.best.deity}</span>}
                {stats.best.angle && <span className={styles.tag}>{stats.best.angle}</span>}
              </div>
              <div className={styles.bestStats}>
                <span>👁 {(stats.best.stats.views || 0).toLocaleString()} views</span>
                <span>👍 {(stats.best.stats.likes || 0).toLocaleString()} likes</span>
                {stats.best.stats.comments > 0 && <span>💬 {stats.best.stats.comments.toLocaleString()}</span>}
              </div>
              {stats.best.videoUrl && (
                <a href={stats.best.videoUrl} target="_blank" rel="noopener noreferrer" className={styles.bestLink}>Watch on YouTube ↗</a>
              )}
            </div>
          </div>
        )}

        {/* Full history list */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>📋 All Uploads ({history.length})</div>
          {history.length === 0
            ? <div className={styles.empty}>No uploads yet. Turn on Auto-mode in Auto Studio to get started.</div>
            : (
              <div className={styles.histList}>
                {history.map((h, i) => (
                  <div key={i} className={styles.histRow}>
                    <div className={styles.histLeft}>
                      <div className={styles.histTitle}>{h.title || h.topic || '—'}</div>
                      <div className={styles.histMeta}>
                        {h.deity && <span className={styles.tag}>{h.deity}</span>}
                        {h.angle && <span className={styles.tag}>{h.angle}</span>}
                        {h.publishAt && <span className={styles.tagDim}>📅 {new Date(h.publishAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                      </div>
                      <div className={styles.histStats}>
                        {h.stats?.views > 0
                          ? <>👁 {h.stats.views.toLocaleString()} &nbsp;👍 {(h.stats.likes || 0).toLocaleString()}</>
                          : <span className={styles.noStats}>No stats — click ↻ Sync Stats</span>}
                      </div>
                    </div>
                    {h.videoUrl && (
                      <a href={h.videoUrl} target="_blank" rel="noopener noreferrer" className={styles.histLink}>↗</a>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>

      </div>
    </div>
  );
}
