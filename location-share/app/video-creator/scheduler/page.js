'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGeneration } from '@/context/GenerationContext';
import { getTopicQueue, FINANCE_TOPICS } from '@/lib/financeTopics';
import { isYouTubeConnected, disconnectYouTube, getUploadHistory } from '@/lib/youtubeUtils';
import styles from './page.module.css';

export default function SchedulerPage() {
  const router = useRouter();
  const { startGeneration } = useGeneration();
  const [ytConnected, setYtConnected] = useState(false);
  const [queue, setQueue] = useState([]);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [generatingIdx, setGeneratingIdx] = useState(null);
  const [autoScript, setAutoScript] = useState(null);

  useEffect(() => {
    setYtConnected(isYouTubeConnected());
    setQueue(getTopicQueue(7));
    setUploadHistory(getUploadHistory());
  }, []);

  const handleDisconnect = () => {
    disconnectYouTube();
    setYtConnected(false);
  };

  const handleOneClick = useCallback(async (topicObj, idx) => {
    setGeneratingIdx(idx);
    setAutoScript(null);
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicObj.topic, angle: topicObj.angle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      startGeneration({
        script: data.script,
        style: 'cinematic',
        format: 'portrait',
        speedMultiplier: 1,
        narration: true,
        voice: 'Brian',
        titleText: data.suggestedTitle || '',
        youtubeTitle: data.youtubeTitle || '',
        youtubeDescription: data.description || '',
        youtubeTags: data.tags || [],
      });

      router.push('/video-creator/generations');
    } catch (err) {
      alert(`Failed: ${err.message}`);
      setGeneratingIdx(null);
    }
  }, [startGeneration, router]);

  const ANGLE_COLORS = {
    'mindset': '#6366f1',
    'investing': '#22c55e',
    'side-income': '#f59e0b',
    'practical': '#3b82f6',
    'debt': '#ef4444',
    'passive-income': '#8b5cf6',
    'controversial': '#ec4899',
    'career': '#14b8a6',
    'education': '#06b6d4',
    'budgeting': '#f97316',
    'tax': '#84cc16',
    'beginner': '#a78bfa',
    'entrepreneurship': '#fb923c',
    'reality-check': '#94a3b8',
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/video-creator" className={styles.back}>← Creator</Link>
        <div className={styles.headerCenter}>
          <span className={styles.logo}>📅</span>
          <div>
            <div className={styles.title}>Content Scheduler</div>
            <div className={styles.subtitle}>Finance YouTube Shorts Automation</div>
          </div>
        </div>
        <Link href="/video-creator/generations" className={styles.historyLink}>Generations →</Link>
      </header>

      <div className={styles.body}>

        {/* YouTube Connection */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>📺 YouTube Channel</div>
            {ytConnected
              ? <button className={styles.disconnectBtn} onClick={handleDisconnect}>Disconnect</button>
              : <a href="/api/youtube/auth" className={styles.connectBtn}>🔗 Connect Channel</a>}
          </div>
          {ytConnected
            ? <div className={styles.connectedBadge}>✅ Connected — uploads go directly to your channel</div>
            : <div className={styles.notConnected}>Connect your YouTube channel to enable one-click upload after generation.</div>}
        </div>

        {/* 7-Day Topic Queue */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>🗓 This Week's Topics</div>
            <div className={styles.cardSub}>Auto-selected · rotates daily</div>
          </div>
          <div className={styles.topicList}>
            {queue.map((t, i) => {
              const isToday = i === 0;
              const color = ANGLE_COLORS[t.angle] || '#6366f1';
              return (
                <div key={i} className={`${styles.topicRow} ${isToday ? styles.topicToday : ''}`}>
                  <div className={styles.topicLeft}>
                    <span className={styles.dayLabel}>{isToday ? 'Today' : `Day ${i + 1}`}</span>
                    <span className={styles.topicText}>{t.topic}</span>
                    <span className={styles.angleTag} style={{ background: `${color}22`, color }}>
                      {t.angle}
                    </span>
                  </div>
                  <button
                    className={`${styles.goBtn} ${isToday ? styles.goBtnPrimary : ''}`}
                    onClick={() => handleOneClick(t, i)}
                    disabled={generatingIdx !== null}
                  >
                    {generatingIdx === i ? <><span className={styles.btnSpinner} /> Generating…</> : '▶ Go'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* How it works */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>🚀 How the Automation Works</div>
          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <div><strong>Pick a topic</strong> — AI auto-selects a viral finance angle each day</div>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <div><strong>Generate script</strong> — Claude writes a 10-scene S-/N- script with YouTube metadata</div>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <div><strong>Render video</strong> — Images + TTS narration + Ken Burns effects + subtitles</div>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>4</span>
              <div><strong>Upload to YouTube</strong> — Auto-title, description, tags, published as Short</div>
            </div>
          </div>
          <div className={styles.oneClickNote}>
            Click <strong>▶ Go</strong> on any topic above to run the full pipeline in one click.
          </div>
        </div>

        {/* Upload History */}
        {uploadHistory.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>📊 Upload History</div>
            <div className={styles.historyList}>
              {uploadHistory.map((h, i) => (
                <div key={i} className={styles.historyItem}>
                  <div className={styles.historyMeta}>
                    <div className={styles.historyTitle}>{h.title}</div>
                    <div className={styles.historyDate}>{new Date(h.uploadedAt).toLocaleString()}</div>
                  </div>
                  <a href={h.videoUrl} target="_blank" rel="noopener noreferrer" className={styles.ytLink}>
                    View ↗
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
