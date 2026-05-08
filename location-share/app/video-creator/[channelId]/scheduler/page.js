'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useGeneration } from '@/context/GenerationContext';
import { CHANNEL_DEFINITIONS, getTopicsByChannelId } from '@/lib/financeTopics';
import { isYouTubeConnected, disconnectYouTube, getUploadHistory } from '@/lib/youtubeUtils';
import styles from './page.module.css';

// Schedule: 3 posts per day at these UTC hours (8am, 2pm, 8pm IST = 2:30, 8:30, 14:30 UTC)
const SCHEDULE_UTC_HOURS = [2, 8, 14];

function getNextSlot() {
  const now = new Date();
  const nowUTC = now.getUTCHours() * 60 + now.getUTCMinutes();
  for (const h of SCHEDULE_UTC_HOURS) {
    const slotMin = h * 60;
    if (nowUTC < slotMin) {
      const d = new Date(now);
      d.setUTCHours(h, 0, 0, 0);
      return d;
    }
  }
  // Next is tomorrow's first slot
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(SCHEDULE_UTC_HOURS[0], 0, 0, 0);
  return d;
}

function fmtCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function autoKey(channelId, slotHour) {
  const d = new Date();
  return `auto_fired_${channelId}_${d.toDateString()}_${slotHour}`;
}

export default function ChannelSchedulerPage() {
  const router = useRouter();
  const { channelId } = useParams();
  const { active, startGeneration } = useGeneration();

  const channel = CHANNEL_DEFINITIONS.find(c => c.id === channelId) || CHANNEL_DEFINITIONS[0];

  const [ytConnected, setYtConnected] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [queue, setQueue] = useState([]);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [countdown, setCountdown] = useState('');
  const [nextSlot, setNextSlot] = useState(null);
  const [runningIdx, setRunningIdx] = useState(null);
  const [log, setLog] = useState([]);
  const runningRef = useRef(false);

  const addLog = useCallback((msg) => {
    setLog(l => [`${new Date().toLocaleTimeString()} — ${msg}`, ...l].slice(0, 30));
  }, []);

  useEffect(() => {
    setYtConnected(isYouTubeConnected(channelId));
    const saved = localStorage.getItem(`autoMode_${channelId}`);
    if (saved === 'true') setAutoMode(true);
    const allTopics = getTopicsByChannelId(channelId);
    const startIdx = Math.floor(Date.now() / 86400000) % allTopics.length;
    setQueue(Array.from({ length: 7 }, (_, i) => allTopics[(startIdx + i) % allTopics.length]));
    setUploadHistory(getUploadHistory().filter(h => h.channelId === channelId));
  }, [channelId]);

  // Countdown timer
  useEffect(() => {
    const tick = () => {
      const next = getNextSlot();
      setNextSlot(next);
      setCountdown(fmtCountdown(next - Date.now()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-trigger: fires at each scheduled UTC hour if autoMode is on
  const triggerAutoGenerate = useCallback(async (topicObj, slotHour) => {
    if (runningRef.current) return;
    runningRef.current = true;
    addLog(`🚀 Auto-generating for slot ${slotHour}:00 UTC — "${topicObj.topic.slice(0, 50)}…"`);

    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicObj.topic, angle: topicObj.angle, genre: topicObj.genre, format: 'portrait', language: 'en' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addLog(`✅ Script ready — starting render`);

      await startGeneration({
        script: data.script,
        style: channel.id === 'comedy' ? 'comic' : 'cinematic',
        format: 'portrait',
        speedMultiplier: 1,
        narration: true,
        voice: 'Brian',
        titleText: data.suggestedTitle || '',
        youtubeTitle: data.youtubeTitle || '',
        youtubeDescription: data.description || '',
        youtubeTags: data.tags || [],
        channelId,
        autoUpload: ytConnected,
        onComplete: (result) => {
          addLog(result.ytVideoUrl
            ? `🎉 Uploaded: ${result.ytVideoUrl}`
            : `📁 Rendered — upload skipped (YouTube not connected)`
          );
          setUploadHistory(getUploadHistory().filter(h => h.channelId === channelId));
          runningRef.current = false;
          router.push('/video-creator/generations');
        },
      });
    } catch (err) {
      addLog(`❌ Failed: ${err.message}`);
      runningRef.current = false;
    }
  }, [addLog, startGeneration, ytConnected, channelId, channel, router]);

  // Check every 30s if we should fire
  useEffect(() => {
    if (!autoMode) return;
    const check = () => {
      const now = new Date();
      const h = now.getUTCHours();
      const m = now.getUTCMinutes();
      if (!SCHEDULE_UTC_HOURS.includes(h) || m >= 2) return;
      const key = autoKey(channelId, h);
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
      const topics = getTopicsByChannelId(channelId);
      const slotIdx = Math.floor(Date.now() / (8 * 3600 * 1000)) % topics.length;
      triggerAutoGenerate(topics[slotIdx], h);
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [autoMode, channelId, triggerAutoGenerate]);

  // Poll /api/queue for cron-pre-generated scripts
  useEffect(() => {
    if (!autoMode) return;
    const poll = async () => {
      try {
        const res = await fetch('/api/queue');
        const { jobs } = await res.json();
        if (!jobs?.length) return;
        addLog(`📥 ${jobs.length} job(s) from server queue — processing…`);
        for (const job of jobs) {
          if (job.channelId !== channelId) continue;
          await startGeneration({
            script: job.script,
            style: job.style || 'cinematic',
            format: job.format || 'portrait',
            language: job.language || 'en',
            speedMultiplier: 1,
            narration: true,
            voice: 'Brian',
            titleText: job.titleText || '',
            youtubeTitle: job.youtubeTitle || '',
            youtubeDescription: job.youtubeDescription || '',
            youtubeTags: job.youtubeTags || [],
            channelId,
            autoUpload: ytConnected,
            onComplete: (result) => {
              addLog(result.ytVideoUrl ? `🎉 Uploaded: ${result.ytVideoUrl}` : `📁 Rendered`);
              setUploadHistory(getUploadHistory().filter(h => h.channelId === channelId));
            },
          });
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 5 * 60_000); // re-check every 5 min
    return () => clearInterval(id);
  }, [autoMode, channelId, startGeneration, ytConnected, addLog]);

  const handleToggleAuto = () => {
    const next = !autoMode;
    setAutoMode(next);
    localStorage.setItem(`autoMode_${channelId}`, next);
    addLog(next ? '▶ Auto-mode ON — will post at 8am, 2pm, 8pm IST' : '⏸ Auto-mode OFF');
  };

  const handleDisconnect = () => {
    disconnectYouTube(channelId);
    setYtConnected(false);
  };

  const handleManual = useCallback(async (topicObj, idx) => {
    setRunningIdx(idx);
    addLog(`▶ Manual: "${topicObj.topic.slice(0, 50)}…"`);
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicObj.topic, angle: topicObj.angle, genre: topicObj.genre }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await startGeneration({
        script: data.script,
        style: channel.id === 'comedy' ? 'comic' : 'cinematic',
        format: 'portrait', speedMultiplier: 1, narration: true, voice: 'Brian',
        titleText: data.suggestedTitle || '',
        youtubeTitle: data.youtubeTitle || '',
        youtubeDescription: data.description || '',
        youtubeTags: data.tags || [],
        channelId,
        autoUpload: ytConnected,
      });
      router.push('/video-creator/generations');
    } catch (err) {
      addLog(`❌ ${err.message}`);
      setRunningIdx(null);
    }
  }, [startGeneration, router, channelId, channel, ytConnected, addLog]);

  const isGenerating = active && ['generating', 'recording', 'uploading', 'waiting'].includes(active.status);

  const ANGLE_COLORS = {
    mindset:'#6366f1',investing:'#22c55e','side-income':'#f59e0b',practical:'#3b82f6',
    debt:'#ef4444','passive-income':'#8b5cf6',controversial:'#ec4899',career:'#14b8a6',
    education:'#06b6d4',budgeting:'#f97316',tax:'#84cc16',beginner:'#a78bfa',
    growth:'#22c55e',debate:'#ec4899',comeback:'#f59e0b',drama:'#ec4899',
    rivalry:'#ef4444',wisdom:'#6366f1',devotion:'#f59e0b',story:'#22c55e',
    funny:'#10b981',relatable:'#f59e0b',comedy:'#10b981',
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href={`/video-creator/${channelId}`} className={styles.back}>← Creator</Link>
        <div className={styles.headerCenter}>
          <span className={styles.logo}>{channel.icon}</span>
          <div>
            <div className={styles.title}>{channel.name} — Auto Publisher</div>
            <div className={styles.subtitle}>3 videos/day · auto-generate · auto-upload</div>
          </div>
        </div>
        <Link href="/video-creator/generations" className={styles.historyLink}>History →</Link>
      </header>

      <div className={styles.body}>

        {/* Auto-mode control */}
        <div className={`${styles.card} ${autoMode ? styles.cardActive : ''}`}>
          <div className={styles.autoRow}>
            <div className={styles.autoLeft}>
              <div className={styles.cardTitle}>
                {autoMode ? '🟢 Auto-mode ON' : '⚪ Auto-mode OFF'}
              </div>
              <div className={styles.cardSub}>
                Posts at <strong>8am · 2pm · 8pm IST</strong> · {ytConnected ? 'uploads to YouTube' : 'saves locally'}
              </div>
              {autoMode && (
                <div className={styles.countdown}>
                  Next post in <span className={styles.countdownTime}>{countdown}</span>
                  {nextSlot && <span className={styles.nextTime}> ({nextSlot.toLocaleTimeString()})</span>}
                </div>
              )}
            </div>
            <button
              className={`${styles.toggleBtn} ${autoMode ? styles.toggleOn : styles.toggleOff}`}
              onClick={handleToggleAuto}
            >
              {autoMode ? 'Turn Off' : 'Turn On'}
            </button>
          </div>
          {autoMode && !ytConnected && (
            <div className={styles.warnBanner}>
              ⚠️ YouTube not connected — videos will render but not upload. <a href={`/api/youtube/auth?channelId=${channelId}`} className={styles.connectInline}>Connect now →</a>
            </div>
          )}
        </div>

        {/* YouTube Connection */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>📺 YouTube Channel</div>
            {ytConnected
              ? <button className={styles.disconnectBtn} onClick={handleDisconnect}>Disconnect</button>
              : <a href={`/api/youtube/auth?channelId=${channelId}`} className={styles.connectBtn}>🔗 Connect Channel</a>}
          </div>
          {ytConnected
            ? <div className={styles.connectedBadge}>✅ Connected — auto-uploads enabled</div>
            : <div className={styles.notConnected}>Connect once → all future videos upload automatically.</div>}
        </div>

        {/* Activity log */}
        {log.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>📋 Activity Log</div>
            <div className={styles.logList}>
              {log.map((line, i) => <div key={i} className={styles.logLine}>{line}</div>)}
            </div>
          </div>
        )}

        {/* 7-Day Queue */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>🗓 This Week's Topics</div>
            <div className={styles.cardSub}>Auto-selected · click ▶ to generate now</div>
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
                    <span className={styles.angleTag} style={{ background: `${color}22`, color }}>{t.angle}</span>
                  </div>
                  <button
                    className={`${styles.goBtn} ${isToday ? styles.goBtnPrimary : ''}`}
                    onClick={() => handleManual(t, i)}
                    disabled={isGenerating || runningIdx !== null}
                  >
                    {runningIdx === i ? <><span className={styles.btnSpinner} /> Generating…</> : '▶ Now'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* How it works */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>⚡ How Full-Auto Works</div>
          <div className={styles.steps}>
            {[
              ['1', 'Cron fires 3×/day', 'Pre-generates scripts in the background (even when app is closed)'],
              ['2', 'App detects queued jobs', 'On next open, picks up pre-generated scripts automatically'],
              ['3', 'Renders in browser', 'Canvas + TTS + Ken Burns — takes ~2 min per video'],
              ['4', 'Uploads to YouTube', 'Title, description, tags, published as Short instantly'],
            ].map(([n, title, desc]) => (
              <div key={n} className={styles.step}>
                <span className={styles.stepNum}>{n}</span>
                <div><strong>{title}</strong> — {desc}</div>
              </div>
            ))}
          </div>
          <div className={styles.oneClickNote}>
            <strong>Keep this tab open</strong> for truly zero-touch operation — or just open the app once a day to batch-render queued videos.
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
                  <a href={h.videoUrl} target="_blank" rel="noopener noreferrer" className={styles.ytLink}>View ↗</a>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
