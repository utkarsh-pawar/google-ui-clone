'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useGeneration } from '@/context/GenerationContext';
import { CHANNEL_DEFINITIONS, getTopicsByChannelId } from '@/lib/financeTopics';
import { isYouTubeConnected, disconnectYouTube, getUploadHistory } from '@/lib/youtubeUtils';
import { loadSchedule, saveSchedule, getNextPublishTime, formatPublishTime, formatIST, TIME_OPTIONS } from '@/lib/postingSchedule';
import styles from './page.module.css';

function fmtCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function autoKey(channelId, slot) {
  return `auto_fired_${channelId}_${new Date().toDateString()}_${slot}`;
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

  // Posting schedule
  const [scheduleSlots, setScheduleSlots] = useState(['08:00', '13:00', '18:00']);
  const [nextPublish, setNextPublish] = useState(null);
  const [sysStatus, setSysStatus] = useState(null);

  useEffect(() => {
    const saved = loadSchedule();
    setScheduleSlots(saved);
    setNextPublish(getNextPublishTime());
    fetch('/api/debug').then(r => r.json()).then(setSysStatus).catch(() => {});
  }, []);

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
      const next = getNextPublishTime();
      setNextSlot(next);
      setNextPublish(next);
      setCountdown(fmtCountdown(next - Date.now()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduleSlots]);

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

  // Check every 60s if any schedule slot is now (within 2 min window)
  useEffect(() => {
    if (!autoMode) return;
    const IST_OFFSET = 5.5 * 60;
    const check = () => {
      const now = new Date();
      const istMin = ((now.getUTCHours() * 60 + now.getUTCMinutes()) + IST_OFFSET) % (24 * 60);
      for (const slot of scheduleSlots) {
        const [h, m] = slot.split(':').map(Number);
        const slotMin = h * 60 + m;
        if (Math.abs(istMin - slotMin) > 2) continue;
        const key = autoKey(channelId, slot);
        if (localStorage.getItem(key)) continue;
        localStorage.setItem(key, '1');
        const topics = getTopicsByChannelId(channelId);
        const slotIdx = Math.floor(Date.now() / (8 * 3600 * 1000)) % topics.length;
        triggerAutoGenerate(topics[slotIdx], slot);
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [autoMode, channelId, triggerAutoGenerate, scheduleSlots]);

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
          const publishAt = getNextPublishTime().toISOString();
          await startGeneration({
            script: job.script,
            style: job.style || 'divine',
            format: job.format || 'portrait',
            language: job.language || 'hi',
            speedMultiplier: 1, narration: true, voice: 'Brian',
            titleText: job.titleText || '',
            youtubeTitle: job.youtubeTitle || '',
            youtubeDescription: job.youtubeDescription || '',
            youtubeTags: job.youtubeTags || [],
            channelId, autoUpload: ytConnected, publishAt,
            deity: job.deity || '', angle: job.angle || '', topic: job.topic || '',
            onComplete: (result) => {
              addLog(result.ytVideoUrl
                ? `🎉 Scheduled: ${result.ytVideoUrl} → ${formatPublishTime(new Date(publishAt))}`
                : `📁 Rendered`);
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

        {/* Posting schedule picker */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>🕐 Posting Schedule (IST)</div>
          <div className={styles.cardSub}>Choose up to 3 times per day. Videos upload as <strong>scheduled</strong> — YouTube publishes them automatically.</div>
          <div className={styles.slotRow}>
            {[0, 1, 2].map(i => (
              <div key={i} className={styles.slotItem}>
                <div className={styles.slotLabel}>Slot {i + 1}</div>
                <select
                  className={styles.slotSelect}
                  value={scheduleSlots[i] || ''}
                  onChange={e => {
                    const next = [...scheduleSlots];
                    if (e.target.value) next[i] = e.target.value;
                    else next.splice(i, 1);
                    const filtered = next.filter(Boolean);
                    setScheduleSlots(filtered);
                    saveSchedule(filtered);
                    setNextPublish(getNextPublishTime());
                  }}
                >
                  <option value="">— off —</option>
                  {TIME_OPTIONS.map(t => (
                    <option key={t} value={t}>{formatIST(t)}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {nextPublish && (
            <div className={styles.nextPublish}>
              📅 Next publish: <strong>{formatPublishTime(nextPublish)}</strong>
            </div>
          )}
        </div>

        {/* System status — KV, Groq, TTS */}
        {sysStatus && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>🔧 System Status</div>
            <div className={styles.statusGrid}>
              <div className={`${styles.statusItem} ${sysStatus.KV_queue?.startsWith('connected') ? styles.statusOk : styles.statusWarn}`}>
                <span className={styles.statusIcon}>{sysStatus.KV_queue?.startsWith('connected') ? '✅' : '⚠️'}</span>
                <div>
                  <div className={styles.statusLabel}>KV Queue</div>
                  <div className={styles.statusVal}>{sysStatus.KV_queue?.startsWith('connected') ? 'Connected — queue persists across restarts' : 'Not set — queue is in-memory only (lost on restart)'}</div>
                  {!sysStatus.KV_queue?.startsWith('connected') && (
                    <div className={styles.statusHint}>Free setup: upstash.com → Create Database → copy REST URL + token → add UPSTASH_REDIS_REST_URL &amp; UPSTASH_REDIS_REST_TOKEN to Vercel env vars → redeploy</div>
                  )}
                </div>
              </div>
              <div className={`${styles.statusItem} ${sysStatus.GROQ_API_KEY !== 'NOT SET — get free key at console.groq.com' ? styles.statusOk : styles.statusWarn}`}>
                <span className={styles.statusIcon}>{sysStatus.GROQ_API_KEY?.startsWith('set') ? '✅' : '⚠️'}</span>
                <div>
                  <div className={styles.statusLabel}>AI Script (Groq)</div>
                  <div className={styles.statusVal}>{sysStatus.script_model || '—'}</div>
                  {!sysStatus.GROQ_API_KEY?.startsWith('set') && (
                    <div className={styles.statusHint}>Get free key at console.groq.com → add GROQ_API_KEY to Vercel env</div>
                  )}
                </div>
              </div>
              <div className={`${styles.statusItem} ${sysStatus.ELEVENLABS_API_KEY?.startsWith('set') ? styles.statusOk : styles.statusNeutral}`}>
                <span className={styles.statusIcon}>{sysStatus.ELEVENLABS_API_KEY?.startsWith('set') ? '✅' : 'ℹ️'}</span>
                <div>
                  <div className={styles.statusLabel}>Voice (TTS)</div>
                  <div className={styles.statusVal}>{sysStatus.tts_active_source || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Auto-mode control */}
        <div className={`${styles.card} ${autoMode ? styles.cardActive : ''}`}>
          <div className={styles.autoRow}>
            <div className={styles.autoLeft}>
              <div className={styles.cardTitle}>
                {autoMode ? '🟢 Auto-mode ON' : '⚪ Auto-mode OFF'}
              </div>
              <div className={styles.cardSub}>
                Posts at <strong>{scheduleSlots.map(formatIST).join(' · ')} IST</strong> · {ytConnected ? 'scheduled on YouTube' : 'saves locally'}
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
