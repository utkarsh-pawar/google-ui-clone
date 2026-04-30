'use client';
import Link from 'next/link';
import { useGeneration } from '@/context/GenerationContext';
import styles from './page.module.css';

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
                : <div className={styles.imgLoading}>Generating…</div>
            }
          </div>
          <div className={styles.sceneText}>
            <span className={styles.sceneNum}>Scene {i + 1}</span>
            <p>{scene.text.slice(0, 100)}{scene.text.length > 100 ? '…' : ''}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActiveGeneration({ active, cancelGeneration }) {
  const isGenerating = active.status === 'generating';
  const isRecording = active.status === 'recording';
  const isDone = active.status === 'done';
  const isError = active.status === 'error';
  const isCancelled = active.status === 'cancelled';

  return (
    <div className={styles.activeCard}>
      <div className={styles.activeHeader}>
        <div className={styles.activeTitle}>
          {isGenerating && <span className={styles.spinner} />}
          {isRecording && <span className={styles.spinner} />}
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
        <ProgressBar
          current={active.progress.current}
          total={active.progress.total}
          step={active.progress.step}
        />
      )}

      {isRecording && (
        <div className={styles.recordingNote}>Recording video — keep this tab open until complete</div>
      )}

      {isError && (
        <div className={styles.errorBox}>⚠ {active.error}</div>
      )}

      {isCancelled && (
        <div className={styles.cancelledBox}>Generation was cancelled.</div>
      )}

      {isDone && active.videoUrl && (
        <div className={styles.doneActions}>
          <video src={active.videoUrl} controls className={styles.video} />
          <a
            href={active.videoUrl}
            download={`${active.title || 'video'}.webm`}
            className={styles.downloadBtn}
          >
            ⬇ Download Video
          </a>
        </div>
      )}

      {active.scenes?.length > 0 && (
        <SceneGrid scenes={active.scenes} />
      )}
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
        <Link href="/" className={styles.homeLink}>Home →</Link>
      </header>

      <div className={styles.body}>
        {hasActive ? (
          <ActiveGeneration active={active} cancelGeneration={cancelGeneration} />
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🎬</div>
            <div className={styles.emptyTitle}>No active generation</div>
            <div className={styles.emptySub}>
              <Link href="/video-creator" className={styles.emptyLink}>Create a new video →</Link>
            </div>
          </div>
        )}

        {historyItems.length > 0 && (
          <div className={styles.historySection}>
            <div className={styles.sectionTitle}>Previous Generations</div>
            <div className={styles.historyList}>
              {historyItems.map(item => (
                <HistoryItem key={item.id} item={item} />
              ))}
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
