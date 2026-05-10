'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

// Server schedule: cron fires at these IST times (fixed in vercel.json)
const SERVER_SLOTS = ['8:00 AM', '1:00 PM', '6:00 PM'];

const STATUS_LABELS = {
  script: 'Generating script…',
  images: 'Fetching images…',
  audio:  'Generating audio…',
  render: 'Rendering video…',
  upload: 'Uploading to YouTube…',
  done:   'Done ✓',
  failed: 'Failed',
};

const STATUS_COLOR = {
  script: '#818cf8',
  images: '#f59e0b',
  audio:  '#34d399',
  render: '#60a5fa',
  upload: '#a78bfa',
  done:   '#4ade80',
  failed: '#ef4444',
};

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function duration(job) {
  if (!job.startedAt) return '';
  const end = job.completedAt || Date.now();
  const s = Math.round((end - job.startedAt) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function AutoStudioPage() {
  const [jobs, setJobs]               = useState([]);
  const [autoMode, setAutoMode]       = useState(false);
  const [videoFormat, setVideoFormat] = useState('portrait');
  const [saving, setSaving]           = useState(false);
  const [ytStored, setYtStored]       = useState(false);
  const [lastPoll, setLastPoll]       = useState(null);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/studio-status');
      const data = await res.json();
      setJobs(data.jobs || []);
      setAutoMode(!!data.config?.autoMode);
      setVideoFormat(data.config?.videoFormat || 'portrait');
      setLastPoll(Date.now());
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    // Check if YouTube token is stored server-side
    fetch('/api/studio-config').then(r => r.json()).then(cfg => {
      setYtStored(!!cfg?.ytTokenStored);
    }).catch(() => {});

    // Poll every 12s so progress updates show without manual refresh
    pollRef.current = setInterval(fetchStatus, 12000);
    return () => clearInterval(pollRef.current);
  }, [fetchStatus]);

  const saveConfig = useCallback(async (patch) => {
    setSaving(true);
    try {
      await fetch('/api/studio-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoMode, videoFormat, channelId: 'chants', ...patch }),
      });
    } catch {}
    setSaving(false);
  }, [autoMode, videoFormat]);

  const toggleAutoMode = useCallback(async () => {
    const next = !autoMode;
    await saveConfig({ autoMode: next });
    setAutoMode(next);
  }, [autoMode, saveConfig]);

  const changeFormat = useCallback(async (fmt) => {
    setVideoFormat(fmt);
    await saveConfig({ videoFormat: fmt });
  }, [saveConfig]);

  const activeJob = jobs.find(j => !['done', 'failed'].includes(j.status));
  const recentDone = jobs.filter(j => ['done', 'failed'].includes(j.status)).slice(0, 8);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>🕉️</span>
          <div>
            <span className={styles.brandName}>Auto Studio</span>
            <span className={styles.brandTag}>server</span>
            <div className={styles.brandSub}>Zero-click — close this tab anytime</div>
          </div>
        </div>
        <div className={styles.nav}>
          <a href="/api/youtube/auth?channelId=chants" className={styles.ytBtn}>🔗 Connect YouTube</a>
          <Link href="/auto-studio/history" className={styles.navLink}>📊 History</Link>
          <Link href="/video-creator/chants" className={styles.navLink}>Manual →</Link>
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
                  ? `Server generates & uploads at ${SERVER_SLOTS.join(' · ')} IST — no tab needed`
                  : 'Turn on to let the server generate and upload automatically every day'}
              </div>
              {autoMode && (
                <div className={styles.slotsNote}>
                  🕐 Fixed schedule: {SERVER_SLOTS.join(' · ')} IST
                </div>
              )}
            </div>
            <button
              className={`${styles.toggle} ${autoMode ? styles.toggleOn : styles.toggleOff}`}
              onClick={toggleAutoMode}
              disabled={saving}
            >{saving ? '…' : autoMode ? 'Turn Off' : 'Turn On'}</button>
          </div>
          {autoMode && (
            <div className={styles.warn}>
              ⚡ Server runs even when this tab is closed. Connect YouTube below to enable auto-upload.
            </div>
          )}
        </div>

        {/* Video format */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>🎬 Video Format</div>
          <div className={styles.autoDesc}>Choose the format for every scheduled upload.</div>
          <div className={styles.fmtRow}>
            {[
              { id: 'portrait',  icon: '📱', label: 'Shorts',    meta: '~45 sec · 9:16 vertical' },
              { id: 'landscape', icon: '📺', label: 'Long video', meta: '~5 min · 16:9 horizontal' },
              { id: 'longform',  icon: '🎥', label: 'Full story', meta: '~7 min · 16:9 horizontal' },
            ].map(f => (
              <button
                key={f.id}
                className={`${styles.fmtBtn} ${videoFormat === f.id ? styles.fmtBtnActive : ''}`}
                onClick={() => changeFormat(f.id)}
                disabled={saving}
              >
                <span className={styles.fmtLabel}>{f.icon} {f.label}</span>
                <span className={styles.fmtMeta}>{f.meta}</span>
              </button>
            ))}
          </div>
          {videoFormat !== 'portrait' && (
            <div className={styles.warn}>
              ⏱ Long videos may use the full 5-min server budget. Make sure your Vercel plan supports <code>maxDuration=300</code>.
            </div>
          )}
        </div>

        {/* YouTube connection status */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>📺 YouTube Connection</div>
          <div className={styles.autoDesc}>
            The server needs your YouTube token to upload automatically. Connect once — it's saved server-side permanently.
          </div>
          <a href="/api/youtube/auth?channelId=chants" className={styles.connectBtn}>
            🔗 Connect / Reconnect YouTube Channel
          </a>
        </div>

        {/* Active job */}
        {activeJob && (
          <div className={styles.card} style={{ borderColor: STATUS_COLOR[activeJob.status] + '55' }}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>⚙️ Running Now</div>
              <div className={styles.jobDur}>{duration(activeJob)}</div>
            </div>
            <div className={styles.runBar}>
              <span className={styles.spin} />
              <span style={{ color: STATUS_COLOR[activeJob.status] }}>
                {STATUS_LABELS[activeJob.status] || activeJob.status}
              </span>
              {activeJob.progress && <span className={styles.runProg}>{activeJob.progress}</span>}
            </div>
            {activeJob.deity && (
              <div className={styles.jobMeta}>
                {activeJob.deity && <span className={styles.tag}>{activeJob.deity}</span>}
                {activeJob.angle && <span className={styles.tag}>{activeJob.angle}</span>}
                {activeJob.youtubeTitle && (
                  <span className={styles.jobTitle}>{activeJob.youtubeTitle.slice(0, 60)}</span>
                )}
              </div>
            )}
            <div className={styles.pollNote}>
              Auto-refreshes every 12s · last updated {timeAgo(lastPoll)}
            </div>
          </div>
        )}

        {/* Recent jobs */}
        {recentDone.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>📋 Recent Jobs</div>
            <div className={styles.jobList}>
              {recentDone.map(job => (
                <div key={job.id} className={styles.jobRow}>
                  <div
                    className={styles.jobDot}
                    style={{ background: STATUS_COLOR[job.status] || '#4a5580' }}
                  />
                  <div className={styles.jobInfo}>
                    <div className={styles.jobLabel}>
                      {job.deity && <span className={styles.tag}>{job.deity}</span>}
                      {job.youtubeTitle
                        ? <span className={styles.jobTitle}>{job.youtubeTitle.slice(0, 55)}</span>
                        : <span className={styles.jobTitle}>{job.topic?.slice(0, 55)}</span>}
                    </div>
                    <div className={styles.jobSub}>
                      {STATUS_LABELS[job.status] || job.status}
                      {job.error && <span className={styles.jobErr}> — {job.error.slice(0, 80)}</span>}
                      {' · '}{timeAgo(job.startedAt)}
                      {job.completedAt && ` · took ${duration(job)}`}
                    </div>
                  </div>
                  {job.ytVideoUrl && (
                    <a href={job.ytVideoUrl} target="_blank" rel="noopener noreferrer" className={styles.viewBtn}>↗</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {jobs.length === 0 && (
          <div className={styles.card}>
            <div className={styles.empty}>
              No jobs yet. Turn on Auto-mode — the server will start generating at the next scheduled time (8 AM, 1 PM, or 6 PM IST).
            </div>
          </div>
        )}

        <div className={styles.hint}>
          Server pipeline: script → images → audio → FFmpeg → YouTube upload · no browser required
        </div>
      </div>
    </div>
  );
}
