'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useGeneration } from '@/context/GenerationContext';
import { CHANNEL_DEFINITIONS, getTopicsByChannelId } from '@/lib/financeTopics';
import { isYouTubeConnected, disconnectYouTube, getUploadHistory } from '@/lib/youtubeUtils';
import styles from './page.module.css';

export default function ChannelSchedulerPage() {
  const router = useRouter();
  const { channelId } = useParams();
  const { startGeneration } = useGeneration();

  const channel = CHANNEL_DEFINITIONS.find(c => c.id === channelId) || CHANNEL_DEFINITIONS[0];

  const [ytConnected, setYtConnected] = useState(false);
  const [queue, setQueue] = useState([]);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [generatingIdx, setGeneratingIdx] = useState(null);

  useEffect(() => {
    setYtConnected(isYouTubeConnected(channelId));
    const allTopics = getTopicsByChannelId(channelId);
    const startIdx = Math.floor(Date.now() / 86400000) % allTopics.length;
    setQueue(Array.from({ length: 7 }, (_, i) => allTopics[(startIdx + i) % allTopics.length]));
    const history = getUploadHistory().filter(h => h.channelId === channelId);
    setUploadHistory(history);
  }, [channelId]);

  const handleDisconnect = () => {
    disconnectYouTube(channelId);
    setYtConnected(false);
  };

  const handleOneClick = useCallback(async (topicObj, idx) => {
    setGeneratingIdx(idx);
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicObj.topic, angle: topicObj.angle, genre: topicObj.genre }),
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
        channelId,
      });

      router.push('/video-creator/generations');
    } catch (err) {
      alert(`Script generation failed:\n\n${err.message}`);
      setGeneratingIdx(null);
    }
  }, [startGeneration, router, channelId]);

  const ANGLE_COLORS = {
    'mindset': '#6366f1', 'investing': '#22c55e', 'side-income': '#f59e0b',
    'practical': '#3b82f6', 'debt': '#ef4444', 'passive-income': '#8b5cf6',
    'controversial': '#ec4899', 'career': '#14b8a6', 'education': '#06b6d4',
    'budgeting': '#f97316', 'tax': '#84cc16', 'beginner': '#a78bfa',
    'entrepreneurship': '#fb923c', 'reality-check': '#94a3b8',
    'growth': '#22c55e', 'debate': '#ec4899', 'comeback': '#f59e0b',
    'prediction': '#6366f1', 'culture': '#14b8a6', 'highlights': '#3b82f6',
    'rivalry': '#ef4444', 'drama': '#ec4899', 'talent': '#a78bfa',
    'greatness': '#f59e0b', 'controversy': '#ef4444', 'records': '#22c55e',
    'business': '#06b6d4', 'leadership': '#3b82f6',
    'wisdom': '#6366f1', 'devotion': '#f59e0b', 'story': '#22c55e',
    'practice': '#3b82f6', 'philosophy': '#8b5cf6', 'pilgrimage': '#f97316',
    'inspiration': '#ec4899', 'festival': '#fb923c',
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href={`/video-creator/${channelId}`} className={styles.back}>← Creator</Link>
        <div className={styles.headerCenter}>
          <span className={styles.logo}>{channel.icon}</span>
          <div>
            <div className={styles.title}>{channel.name} — Scheduler</div>
            <div className={styles.subtitle}>{channel.genres.join(' · ')} automation</div>
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
              : <a href={`/api/youtube/auth?channelId=${channelId}`} className={styles.connectBtn}>🔗 Connect Channel</a>}
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
              <div><strong>Pick a topic</strong> — auto-selected from {channel.name}&apos;s genre pool</div>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <div><strong>Generate script</strong> — AI writes a 10-scene S-/N- script with YouTube metadata</div>
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
