'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useGeneration } from '@/context/GenerationContext';
import { loadSchedule, saveSchedule, formatIST } from '@/lib/postingSchedule';
import { isYouTubeConnected, getUploadHistory, disconnectYouTube } from '@/lib/youtubeUtils';
import styles from './page.module.css';

// Hindu weekday deity tradition
const WEEKDAY = [
  { deity: 'Surya',   hindi: 'सूर्य देव',   emoji: '☀️', day: 'Ravivaar',   color: '#f97316', angles: ['story','wisdom'],    topic: 'सूर्य देव की महिमा — सुबह की पहली किरण का रहस्य' },
  { deity: 'Shiva',   hindi: 'शिव जी',       emoji: '🔱', day: 'Somvaar',    color: '#818cf8', angles: ['shloka','prayer'],   topic: 'ॐ नमः शिवाय — सोमवार को शिव की आराधना का असली अर्थ' },
  { deity: 'Hanuman', hindi: 'हनुमान जी',    emoji: '🙏', day: 'Mangalvaar', color: '#ef4444', angles: ['prayer','story'],    topic: 'मंगलवार का व्रत — हनुमान जी की कृपा पाने का सही तरीका' },
  { deity: 'Ganesha', hindi: 'गणेश जी',      emoji: '🐘', day: 'Budhvaar',   color: '#a855f7', angles: ['wisdom','prayer'],   topic: 'बुधवार को गणेश जी — विघ्नहर्ता की कृपा से बाधाएं हटाएं' },
  { deity: 'Vishnu',  hindi: 'विष्णु जी',    emoji: '🪷', day: 'Guruvaar',   color: '#3b82f6', angles: ['story','teaching'],  topic: 'गुरुवार को विष्णु भगवान — पालनहार की कहानी' },
  { deity: 'Lakshmi', hindi: 'लक्ष्मी माता', emoji: '🌸', day: 'Shukravaar', color: '#f59e0b', angles: ['prayer','shloka'],   topic: 'शुक्रवार को लक्ष्मी माता — धन और सुख-समृद्धि की आरती' },
  { deity: 'Hanuman', hindi: 'हनुमान जी',    emoji: '🙏', day: 'Shanivaar',  color: '#ef4444', angles: ['shloka','prayer'],   topic: 'शनिवार को हनुमान चालीसा — शनि के प्रकोप से मुक्ति' },
];

const CHANTS_TAGS = ['#bhagavadgita','#shorts','#spiritual','#hindiwisdom','#hanumanchalisa','#sanatan','#viral','#bhakti','#devotional','#india'];
const IST_OFFSET = 5.5 * 60; // minutes

function todayDeity() { return WEEKDAY[new Date().getDay()]; }

function buildPerfSummary(history) {
  const withStats = history.filter(h => h.stats?.views > 0);
  if (withStats.length < 3) return '';
  const byDeity = {}, byAngle = {};
  for (const h of withStats) {
    if (h.deity) { byDeity[h.deity] = byDeity[h.deity] || { t: 0, n: 0 }; byDeity[h.deity].t += h.stats.views; byDeity[h.deity].n++; }
    if (h.angle) { byAngle[h.angle] = byAngle[h.angle] || { t: 0, n: 0 }; byAngle[h.angle].t += h.stats.views; byAngle[h.angle].n++; }
  }
  const topDeity = Object.entries(byDeity).map(([d, s]) => ({ d, avg: Math.round(s.t / s.n) })).sort((a, b) => b.avg - a.avg).slice(0, 3).map(x => `${x.d} (${x.avg} avg views)`).join(', ');
  const topAngle = Object.entries(byAngle).map(([a, s]) => ({ a, avg: s.t / s.n })).sort((a, b) => b.avg - a.avg)[0]?.a || 'story';
  return `${withStats.length} videos analyzed. Top deities: ${topDeity}. Best angle: ${topAngle}. Prioritize content style that historically performed best for this channel.`;
}

function bestAngleFromHistory(history, fallback) {
  const withStats = history.filter(h => h.stats?.views > 0 && h.angle);
  if (withStats.length < 3) return fallback[0];
  const byAngle = {};
  for (const h of withStats) { byAngle[h.angle] = byAngle[h.angle] || { t: 0, n: 0 }; byAngle[h.angle].t += h.stats.views; byAngle[h.angle].n++; }
  return Object.entries(byAngle).map(([a, s]) => ({ a, avg: s.t / s.n })).sort((a, b) => b.avg - a.avg)[0]?.a || fallback[0];
}

function fmtMs(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');
}

function deityRanking(history) {
  const by = {};
  for (const h of history) {
    if (!h.deity || !h.stats?.views) continue;
    by[h.deity] = by[h.deity] || { t: 0, n: 0 };
    by[h.deity].t += h.stats.views;
    by[h.deity].n++;
  }
  return Object.entries(by).map(([d, s]) => ({ d, avg: Math.round(s.t / s.n) })).sort((a, b) => b.avg - a.avg);
}

// Convert stored "HH:MM" (24h) → { h, m, ampm } for display
function to12h(slot) {
  if (!slot) return { h: '8', m: '00', ampm: 'AM' };
  const [hh, mm] = slot.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12  = hh % 12 || 12;
  return { h: String(h12), m: String(mm).padStart(2, '0'), ampm };
}

// Convert { h, m, ampm } → "HH:MM" (24h)
function to24h(h, m, ampm) {
  let hour = parseInt(h, 10);
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${m}`;
}

const HOURS   = ['1','2','3','4','5','6','7','8','9','10','11','12'];
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];

function TimePicker({ value, onChange, onClear, label }) {
  const { h, m, ampm } = to12h(value);
  const update = (newH, newM, newAmpm) => onChange(to24h(newH, newM, newAmpm));
  return (
    <div className={styles.timePicker}>
      <div className={styles.timeLabel}>{label}</div>
      <div className={styles.timeRow}>
        <select className={styles.timeSel} value={h} onChange={e => update(e.target.value, m, ampm)}>
          {HOURS.map(hr => <option key={hr} value={hr}>{hr}</option>)}
        </select>
        <span className={styles.timeSep}>:</span>
        <select className={styles.timeSel} value={m} onChange={e => update(h, e.target.value, ampm)}>
          {MINUTES.map(mn => <option key={mn} value={mn}>{mn}</option>)}
        </select>
        <select className={styles.timeAmpm} value={ampm} onChange={e => update(h, m, e.target.value)}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
        {onClear && (
          <button className={styles.timeClear} onClick={onClear} title="Remove slot">✕</button>
        )}
      </div>
    </div>
  );
}

export default function V2Page() {
  const { active, startGeneration, approvePhase } = useGeneration();
  const [autoMode, setAutoMode]   = useState(false);
  const [slots, setSlots]         = useState(['08:00', '13:00', '18:00']);
  const [ytConnected, setYtConn]  = useState(false);
  const [history, setHistory]     = useState([]);
  const [log, setLog]             = useState([]);
  const [countdown, setCountdown] = useState('--:--:--');
  const [nextTrig, setNextTrig]   = useState(null);
  const [perfRank, setPerfRank]   = useState([]);
  const runRef = useRef(false);

  useEffect(() => {
    setSlots(loadSchedule());
    setYtConn(isYouTubeConnected('chants'));
    const h = getUploadHistory();
    setHistory(h);
    setPerfRank(deityRanking(h));
    setAutoMode(localStorage.getItem('auto_studio_auto') === 'true');
    try { setLog(JSON.parse(localStorage.getItem('auto_studio_log') || '[]')); } catch {}
  }, []);

  const addLog = useCallback((msg) => {
    const line = `${new Date().toLocaleTimeString()} — ${msg}`;
    setLog(prev => {
      const next = [line, ...prev].slice(0, 50);
      try { localStorage.setItem('auto_studio_log', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Zero-click: auto-approve review phases
  useEffect(() => {
    if (!autoMode || !active) return;
    if (active.status === 'review-images' || active.status === 'review-audio') {
      const t = setTimeout(() => { approvePhase(); addLog('⚡ Auto-approved review phase'); }, 2500);
      return () => clearTimeout(t);
    }
  }, [active?.status, autoMode, approvePhase, addLog]);

  // Countdown to next slot
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const istMin = ((now.getUTCHours() * 60 + now.getUTCMinutes()) + IST_OFFSET) % (24 * 60);
      let best = null, bestMs = Infinity;
      for (const slot of slots) {
        const [h, m] = slot.split(':').map(Number);
        const slotMin = h * 60 + m;
        let diff = slotMin - istMin; if (diff < 0) diff += 24 * 60;
        const ms = diff * 60000;
        if (ms < bestMs) { bestMs = ms; best = { slot, ms }; }
      }
      setNextTrig(best);
      setCountdown(fmtMs(best?.ms ?? 0));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [slots]);

  // Core generation function — starts at slot time, uploads as public immediately
  const generate = useCallback(async (slot) => {
    if (runRef.current) return;
    runRef.current = true;
    const d = todayDeity();
    const angle = bestAngleFromHistory(history, d.angles);
    const perfSummary = buildPerfSummary(history);
    addLog(`🚀 ${d.emoji} ${d.hindi} · angle: ${angle} · generating now for ${formatIST(slot)} IST slot`);
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: d.topic, angle, genre: 'chants', deity: d.deity, format: 'portrait', language: 'hi', performanceSummary: perfSummary }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addLog(`✅ Script ready: "${(data.youtubeTitle || d.topic).slice(0, 55)}"`);
      await startGeneration({
        script: data.script, style: 'divine', format: 'portrait',
        speedMultiplier: 1, narration: true, voice: 'Brian',
        titleText: data.suggestedTitle || '', youtubeTitle: data.youtubeTitle || d.topic,
        youtubeDescription: data.description || '', youtubeTags: data.tags || CHANTS_TAGS,
        channelId: 'chants', autoUpload: ytConnected,
        // no publishAt — uploads as public immediately when render is done
        deity: d.deity, angle, topic: d.topic, genre: 'chants',
        onComplete: (result) => {
          if (result.ytVideoUrl) addLog(`🎉 Live on YouTube → ${result.ytVideoUrl}`);
          else addLog('📁 Rendered locally — connect YouTube to auto-upload');
          const h = getUploadHistory();
          setHistory(h); setPerfRank(deityRanking(h));
          runRef.current = false;
        },
      });
    } catch (err) {
      addLog(`❌ ${err.message}`);
      runRef.current = false;
    }
  }, [history, ytConnected, addLog, startGeneration]);

  // Auto-trigger loop — fires at each slot time
  useEffect(() => {
    if (!autoMode) return;
    const check = () => {
      const now = new Date();
      const istMin = ((now.getUTCHours() * 60 + now.getUTCMinutes()) + IST_OFFSET) % (24 * 60);
      for (const slot of slots) {
        const [h, m] = slot.split(':').map(Number);
        const slotMin = h * 60 + m;
        if (Math.abs(istMin - slotMin) > 2) continue;
        const key = `auto_fired_${new Date().toDateString()}_${slot}`;
        if (localStorage.getItem(key)) continue;
        localStorage.setItem(key, '1');
        generate(slot);
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [autoMode, slots, generate]);

  // Queue poll (cron pre-generated scripts)
  useEffect(() => {
    if (!autoMode) return;
    const poll = async () => {
      try {
        const res = await fetch('/api/queue');
        const { jobs } = await res.json();
        const job = (jobs || []).find(j => !j.channelId || j.channelId === 'chants');
        if (!job || runRef.current) return;
        runRef.current = true;
        addLog(`📥 Cron job: "${(job.youtubeTitle || '').slice(0, 50)}"`);
        await startGeneration({
          script: job.script, style: 'divine', format: 'portrait',
          speedMultiplier: 1, narration: true, voice: 'Brian',
          titleText: job.titleText || '', youtubeTitle: job.youtubeTitle || '',
          youtubeDescription: job.youtubeDescription || '', youtubeTags: job.youtubeTags || CHANTS_TAGS,
          channelId: 'chants', autoUpload: ytConnected,
          // no publishAt — goes live immediately on upload
          deity: job.deity || '', angle: job.angle || '', topic: job.topic || '', genre: 'chants',
          onComplete: (result) => {
            addLog(result.ytVideoUrl ? `🎉 Uploaded → ${result.ytVideoUrl}` : '📁 Rendered locally');
            const h = getUploadHistory(); setHistory(h); setPerfRank(deityRanking(h));
            runRef.current = false;
          },
        });
      } catch {}
    };
    poll();
    const id = setInterval(poll, 5 * 60_000);
    return () => clearInterval(id);
  }, [autoMode, ytConnected, addLog, startGeneration]);

  const d = todayDeity();
  const isRunning = active && ['generating','recording','uploading','narration','review-images','review-audio','waiting'].includes(active.status);
  const recent = history.slice(0, 5);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>🕉️</span>
          <div>
            <span className={styles.brandName}>Auto Studio</span>
            <span className={styles.brandTag}>v2</span>
            <div className={styles.brandSub}>Zero-click spiritual publishing</div>
          </div>
        </div>
        <div className={styles.nav}>
          {ytConnected
            ? <button className={styles.ytConn} onClick={() => { disconnectYouTube('chants'); setYtConn(false); }}>📺 Connected ✓</button>
            : <a href="/api/youtube/auth?channelId=chants" className={styles.ytBtn}>🔗 Connect YouTube</a>}
          <Link href="/auto-studio/history" className={styles.navLink}>📊 History</Link>
          <Link href="/video-creator/chants" className={styles.navLink}>v1 →</Link>
        </div>
      </header>

      <div className={styles.body}>

        {/* Auto-mode toggle */}
        <div className={`${styles.card} ${autoMode ? styles.cardGreen : ''}`}>
          <div className={styles.autoRow}>
            <div className={styles.autoLeft}>
              <div className={styles.autoStatus}>{autoMode ? '🟢 Auto-mode ON' : '⚪ Auto-mode OFF'}</div>
              <div className={styles.autoDesc}>
                {autoMode
                  ? `Generates & posts at ${slots.map(formatIST).join(' · ')} IST · goes live immediately`
                  : 'Turn on for fully automatic daily publishing'}
              </div>
              {autoMode && (
                <div className={styles.ctdRow}>
                  Next in <span className={styles.ctd}>{countdown}</span>
                  {nextTrig && <span className={styles.ctdLabel}> · starts generating at {formatIST(nextTrig.slot)} IST</span>}
                </div>
              )}
            </div>
            <button
              className={`${styles.toggle} ${autoMode ? styles.toggleOn : styles.toggleOff}`}
              onClick={() => {
                const n = !autoMode;
                setAutoMode(n);
                localStorage.setItem('auto_studio_auto', n);
                addLog(n ? '▶ Auto-mode ON' : '⏸ Auto-mode OFF');
              }}
            >{autoMode ? 'Turn Off' : 'Turn On'}</button>
          </div>
          {autoMode && !ytConnected && (
            <div className={styles.warn}>
              ⚠️ YouTube not connected — renders but won't upload.&nbsp;
              <a href="/api/youtube/auth?channelId=chants" className={styles.warnLink}>Connect →</a>
            </div>
          )}
        </div>

        {/* Today's deity */}
        <div className={styles.card} style={{ borderLeftColor: d.color, borderLeftWidth: 4 }}>
          <div className={styles.todayRow}>
            <div>
              <div className={styles.todayDay}>{d.day} — today's deity</div>
              <div className={styles.todayDeity} style={{ color: d.color }}>{d.emoji} {d.hindi}</div>
              <div className={styles.todayTopic}>{d.topic}</div>
            </div>
            {perfRank.length > 0 && (
              <div className={styles.bestBadge}>
                <div className={styles.bestLabel}>Top performer</div>
                <div className={styles.bestVal}>{perfRank[0].d}</div>
                <div className={styles.bestAvg}>{perfRank[0].avg} views avg</div>
              </div>
            )}
          </div>
          {isRunning && (
            <div className={styles.runBar}>
              <span className={styles.spin} />
              <span>{active.progress?.step || 'Processing…'}</span>
              {active.progress?.total > 0 && (
                <span className={styles.runProg}>{active.progress.current}/{active.progress.total}</span>
              )}
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>🕐 Generation Schedule (IST)</div>
          <div className={styles.cardSub}>Generation starts at these times. Video goes live on YouTube as soon as rendering finishes (~5–10 min later).</div>
          <div className={styles.slotsStack}>
            {[0, 1, 2].map(i => (
              slots[i]
                ? <TimePicker
                    key={i}
                    label={`Slot ${i + 1}`}
                    value={slots[i]}
                    onChange={val => {
                      const n = [...slots]; n[i] = val;
                      setSlots(n); saveSchedule(n);
                    }}
                    onClear={slots.length > 1 ? () => {
                      const n = slots.filter((_, j) => j !== i);
                      setSlots(n); saveSchedule(n);
                    } : null}
                  />
                : null
            ))}
            {slots.length < 3 && (
              <button className={styles.addSlot} onClick={() => {
                const n = [...slots, '08:00'];
                setSlots(n); saveSchedule(n);
              }}>+ Add slot</button>
            )}
          </div>
        </div>

        {/* Performance leaderboard (if data exists) */}
        {perfRank.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>📈 What's Working</div>
            <div className={styles.cardSub}>System learns from your YouTube stats and biases angle selection toward top performers.</div>
            <div className={styles.rankList}>
              {perfRank.slice(0, 5).map((r, i) => (
                <div key={r.d} className={styles.rankRow}>
                  <span className={styles.rankNum}>#{i + 1}</span>
                  <span className={styles.rankDeity}>{r.d}</span>
                  <div className={styles.rankBar}>
                    <div className={styles.rankFill} style={{ width: `${Math.min(100, (r.avg / (perfRank[0].avg || 1)) * 100)}%` }} />
                  </div>
                  <span className={styles.rankAvg}>{r.avg.toLocaleString()} views</span>
                </div>
              ))}
            </div>
            <Link href="/auto-studio/history" className={styles.detailLink}>Full breakdown →</Link>
          </div>
        )}

        {/* Log */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>📋 Activity Log</div>
            {log.length > 0 && (
              <button className={styles.clearBtn} onClick={() => { setLog([]); localStorage.removeItem('auto_studio_log'); }}>Clear</button>
            )}
          </div>
          <div className={styles.logList}>
            {log.length === 0
              ? <div className={styles.empty}>No activity yet — turn on Auto-mode or keep this tab open.</div>
              : log.map((l, i) => <div key={i} className={styles.logLine}>{l}</div>)
            }
          </div>
        </div>

        {/* Recent uploads */}
        {recent.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>🎬 Recent Uploads</div>
              <Link href="/auto-studio/history" className={styles.seeAll}>See all →</Link>
            </div>
            {recent.map((h, i) => (
              <div key={i} className={styles.uploadRow}>
                <div className={styles.uploadMeta}>
                  <div className={styles.uploadTitle}>{h.title || h.topic || '—'}</div>
                  <div className={styles.uploadTags}>
                    {h.deity && <span className={styles.tag}>{h.deity}</span>}
                    {h.angle && <span className={styles.tag}>{h.angle}</span>}
                    {h.stats?.views > 0 && <span className={styles.tagViews}>👁 {h.stats.views.toLocaleString()}</span>}
                    {!h.stats?.views && <span className={styles.tagDim}>No stats yet</span>}
                  </div>
                </div>
                {h.videoUrl && <a href={h.videoUrl} target="_blank" rel="noopener noreferrer" className={styles.viewBtn}>↗</a>}
              </div>
            ))}
          </div>
        )}

        <div className={styles.hint}>
          Keep this tab open for zero-click operation. The app renders videos locally in your browser.
        </div>
      </div>
    </div>
  );
}
