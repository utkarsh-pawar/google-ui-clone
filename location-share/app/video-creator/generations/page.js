'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useGeneration } from '@/context/GenerationContext';
import { uploadToYouTube, isYouTubeConnected, getFreshToken, uploadThumbnail } from '@/lib/youtubeUtils';
import { generateThumbnail, FORMATS } from '@/lib/videoUtils';
import styles from './page.module.css';

function VideoPlayer({ src }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const fix = () => {
      if (v.duration === Infinity) {
        v.currentTime = 1e101;
        v.addEventListener('seeked', () => { v.currentTime = 0; }, { once: true });
      }
    };
    v.addEventListener('loadedmetadata', fix, { once: true });
    return () => v.removeEventListener('loadedmetadata', fix);
  }, [src]);
  return <video ref={ref} src={src} controls className={styles.video} />;
}

function ThumbnailPanel({ active, uploadedVideoId }) {
  const channelId = active?.channelId || 'general';
  const [thumbUrl, setThumbUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const firstGoodScene = active.scenes?.find(s => s.image);
      const format = FORMATS.find(f => f.id === active.format) || FORMATS[0];
      const blob = await generateThumbnail(firstGoodScene?.image || null, active.youtubeTitle || active.title || '', format);
      setThumbUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }, [active]);

  const handleUploadThumb = useCallback(async () => {
    if (!thumbUrl || !uploadedVideoId) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(thumbUrl);
      const blob = await res.blob();
      await uploadThumbnail(uploadedVideoId, blob, channelId);
      setUploaded(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }, [thumbUrl, uploadedVideoId]);

  return (
    <div className={styles.thumbPanel}>
      <div className={styles.thumbHeader}>
        <span className={styles.thumbTitle}>🖼 Cover Thumbnail</span>
        {!thumbUrl && (
          <button className={styles.thumbGenBtn} onClick={handleGenerate} disabled={generating}>
            {generating ? <><span className={styles.spinner} /> Generating…</> : '✨ Generate Cover'}
          </button>
        )}
      </div>
      {thumbUrl && (
        <div className={styles.thumbPreview}>
          <img src={thumbUrl} alt="Thumbnail preview" className={styles.thumbImg} />
          <div className={styles.thumbActions}>
            <a href={thumbUrl} download="thumbnail.jpg" className={styles.thumbDownloadBtn}>⬇ Download</a>
            {uploadedVideoId && !uploaded && (
              <button className={styles.thumbUploadBtn} onClick={handleUploadThumb} disabled={uploading}>
                {uploading ? <><span className={styles.spinner} /> Uploading…</> : '▲ Set as YouTube Thumbnail'}
              </button>
            )}
            {uploaded && <span className={styles.thumbDone}>✅ Thumbnail set</span>}
            <button className={styles.thumbRegenBtn} onClick={handleGenerate} disabled={generating}>↺ Regenerate</button>
          </div>
        </div>
      )}
      {error && <div className={styles.uploadError}>{error}</div>}
    </div>
  );
}

function UploadButton({ active, onUploaded }) {
  const channelId = active?.channelId || 'general';
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(null);
  const [error, setError] = useState(null);
  const [ytConnected, setYtConnected] = useState(false);

  useEffect(() => { setYtConnected(isYouTubeConnected(channelId)); }, [channelId]);

  const handleUpload = useCallback(async () => {
    if (!active?.videoUrl) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(active.videoUrl);
      const videoBlob = await res.blob();

      const { videoId, videoUrl } = await uploadToYouTube({
        videoBlob,
        title: active.youtubeTitle || active.titleText || active.title || 'Video Short',
        description: active.youtubeDescription || 'Follow for more content.',
        tags: active.youtubeTags || ['#shorts'],
        channelId,
      });
      setUploaded({ videoId, videoUrl });
      onUploaded?.(videoId);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }, [active, channelId]);

  if (uploaded) {
    return (
      <a href={uploaded.videoUrl} target="_blank" rel="noopener noreferrer" className={styles.ytDoneBtn}>
        ✅ View on YouTube →
      </a>
    );
  }

  if (!ytConnected) {
    return (
      <a href={`/api/youtube/auth?channelId=${channelId}`} className={styles.ytConnectBtn}>
        🔗 Connect YouTube to Upload
      </a>
    );
  }

  return (
    <div className={styles.uploadRow}>
      <button className={styles.uploadBtn} onClick={handleUpload} disabled={uploading}>
        {uploading ? <><span className={styles.spinner} /> Uploading…</> : '▲ Upload to YouTube'}
      </button>
      {error && <div className={styles.uploadError}>{error}</div>}
    </div>
  );
}

function ProgressBar({ current, total, step }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className={styles.progressBox}>
      <div className={styles.progressLabel}>{step} ({current}/{total})</div>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SceneGrid({ scenes }) {
  if (!scenes?.length) return null;
  return (
    <div className={styles.sceneCards}>
      {scenes.map((scene, i) => (
        <div key={i} className={styles.sceneCard}>
          <div className={styles.sceneImg}>
            {scene.image
              ? <img src={scene.image.src} alt={`Scene ${i + 1}`} />
              : scene.error
                ? <div className={styles.imgError}>⚠ Failed</div>
                : <div className={styles.imgLoading}>Generating…</div>}
          </div>
          <div className={styles.sceneText}>
            <span className={styles.sceneNum}>Scene {i + 1}</span>
            {scene.narration && (
              <p>{scene.narration.slice(0, 100)}{scene.narration.length > 100 ? '…' : ''}</p>
            )}
            {scene.scenePrompt && scene.scenePrompt !== scene.narration && (
              <p style={{ color: 'var(--dim)', fontSize: '10px', marginTop: '2px' }}>
                🖼 {scene.scenePrompt.slice(0, 80)}{scene.scenePrompt.length > 80 ? '…' : ''}
              </p>
            )}
            {scene.error && scene.errorMsg && (
              <p className={styles.sceneError}>{scene.errorMsg}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActiveGeneration({ active, cancelGeneration }) {
  const [uploadedId, setUploadedId] = useState(null);
  const isGenerating = active.status === 'generating';
  const isRecording = active.status === 'recording';
  const isDone = active.status === 'done';
  const isError = active.status === 'error';
  const isCancelled = active.status === 'cancelled';

  return (
    <div className={styles.activeCard}>
      <div className={styles.activeHeader}>
        <div className={styles.activeTitle}>
          {(isGenerating || isRecording) && <span className={styles.spinner} />}
          {isDone && <span className={styles.statusIcon}>✅</span>}
          {isError && <span className={styles.statusIcon}>❌</span>}
          {isCancelled && <span className={styles.statusIcon}>🚫</span>}
          <span>{active.title || 'Untitled'}</span>
        </div>
        {(isGenerating || isRecording) && (
          <button className={styles.cancelBtn} onClick={cancelGeneration}>Cancel</button>
        )}
      </div>

      {(isGenerating || isRecording) && (
        <ProgressBar current={active.progress.current} total={active.progress.total} step={active.progress.step} />
      )}

      {isRecording && (
        <div className={styles.recordingNote}>Recording video — keep this tab open until complete</div>
      )}

      {isError && <div className={styles.errorBox}>⚠ {active.error}</div>}
      {isCancelled && <div className={styles.cancelledBox}>Generation was cancelled.</div>}

      {isDone && active.videoUrl && (
        <div className={styles.doneActions}>
          <VideoPlayer src={active.videoUrl} />
          <div className={styles.doneButtons}>
            <a href={active.videoUrl} download={`${active.title || 'video'}.webm`} className={styles.downloadBtn}>
              ⬇ Download
            </a>
            <UploadButton active={active} onUploaded={id => setUploadedId(id)} />
          </div>
          {active.youtubeTitle && (
            <div className={styles.ytMetaPreview}>
              <div className={styles.ytMetaRow}><strong>Title:</strong> {active.youtubeTitle}</div>
              {active.youtubeTags?.length > 0 && (
                <div className={styles.ytMetaRow}><strong>Tags:</strong> {active.youtubeTags.slice(0, 5).join(' ')}</div>
              )}
            </div>
          )}
          <ThumbnailPanel active={active} uploadedVideoId={uploadedId} />
        </div>
      )}

      {active.scenes?.length > 0 && <SceneGrid scenes={active.scenes} />}
    </div>
  );
}

function HistoryItem({ item }) {
  const date = new Date(item.createdAt).toLocaleString();
  return (
    <div className={styles.historyItem}>
      <div className={styles.historyMeta}>
        <div className={styles.historyTitle}>{item.title || 'Untitled'}</div>
        <div className={styles.historyDate}>{date}</div>
      </div>
      <div className={styles.historyStats}>
        <span className={styles.badge}>{item.sceneCount || item.scenes?.length || 0} scenes</span>
        <span className={`${styles.badge} ${styles.badgeDone}`}>{item.status}</span>
      </div>
    </div>
  );
}

export default function GenerationsPage() {
  const { active, history, toasts, dismissToast, cancelGeneration } = useGeneration();
  const hasActive = active && active.status !== null;
  const historyItems = history.filter(h => h.id !== active?.id);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/video-creator" className={styles.back}>← New Video</Link>
        <div className={styles.headerCenter}>
          <span className={styles.logo}>🎬</span>
          <div>
            <div className={styles.title}>My Generations</div>
            <div className={styles.subtitle}>Live progress & history</div>
          </div>
        </div>
        <Link href="/video-creator/scheduler" className={styles.homeLink}>Scheduler →</Link>
      </header>

      <div className={styles.body}>
        {hasActive ? (
          <ActiveGeneration active={active} cancelGeneration={cancelGeneration} />
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🎬</div>
            <div className={styles.emptyTitle}>No active generation</div>
            <Link href="/video-creator" className={styles.emptyLink}>Create a new video →</Link>
          </div>
        )}

        {historyItems.length > 0 && (
          <div className={styles.historySection}>
            <div className={styles.sectionTitle}>Previous Generations</div>
            <div className={styles.historyList}>
              {historyItems.map(item => <HistoryItem key={item.id} item={item} />)}
            </div>
          </div>
        )}
      </div>

      {toasts.length > 0 && (
        <div className={styles.toastStack}>
          {toasts.map(t => (
            <div key={t.id} className={styles.toast}>
              <span className={styles.toastIcon}>⚠</span>
              <span className={styles.toastMsg}>{t.msg}</span>
              <button className={styles.toastClose} onClick={() => dismissToast(t.id)}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
