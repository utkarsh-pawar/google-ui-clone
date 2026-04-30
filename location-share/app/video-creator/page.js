'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGeneration } from '@/context/GenerationContext';
import Link from 'next/link';
import { STYLES, TTS_VOICES, splitScenes } from '@/lib/videoUtils';
import styles from './page.module.css';

export default function VideoCreator() {
  const router = useRouter();
  const { startGeneration, active } = useGeneration();
  const [script, setScript] = useState('');
  const [style, setStyle] = useState(STYLES[0].id);
  const [sceneDuration, setSceneDuration] = useState(4);
  const [narration, setNarration] = useState(false);
  const [voice, setVoice] = useState(TTS_VOICES[0].id);

  const sceneList = splitScenes(script);
  const estimatedDuration = sceneList.length * sceneDuration;

  const handleGenerate = () => {
    if (!sceneList.length) return;
    startGeneration({ script, style, sceneDuration, narration, voice });
    router.push('/video-creator/generations');
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>← Back</Link>
        <div className={styles.headerCenter}>
          <span className={styles.logo}>🎬</span>
          <div>
            <div className={styles.title}>Video Creator</div>
            <div className={styles.subtitle}>Script → YouTube video</div>
          </div>
        </div>
        <Link href="/video-creator/generations" className={styles.historyLink}>
          My Generations →
        </Link>
      </header>

      <div className={styles.formBody}>
        <div className={styles.formCard}>
          <div className={styles.sectionTitle}>Your Script</div>
          <textarea
            className={styles.textarea}
            placeholder={`Paste your YouTube script here. Each paragraph becomes one scene.\n\nExample:\nBlack holes are regions of spacetime where gravity is so strong that nothing can escape.\n\nThey form when massive stars collapse at the end of their life cycle.`}
            value={script}
            onChange={e => setScript(e.target.value)}
          />

          {sceneList.length > 0 && (
            <div className={styles.sceneCount}>
              {sceneList.length} scenes · ~{estimatedDuration}s video
            </div>
          )}

          <div className={styles.settings}>
            <div className={styles.settingRow}>
              <label className={styles.settingLabel}>Visual Style</label>
              <div className={styles.styleGrid}>
                {STYLES.map(s => (
                  <button
                    key={s.id}
                    className={`${styles.styleBtn} ${style === s.id ? styles.styleBtnActive : ''}`}
                    onClick={() => setStyle(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.settingRow}>
              <label className={styles.settingLabel}>
                Seconds per scene: <strong>{sceneDuration}s</strong>
              </label>
              <input
                type="range" min={2} max={10} value={sceneDuration}
                onChange={e => setSceneDuration(Number(e.target.value))}
                className={styles.range}
              />
              <div className={styles.rangeLabels}><span>2s (fast)</span><span>10s (slow)</span></div>
            </div>

            <div className={styles.settingRow}>
              <label className={styles.narrationToggle}>
                <div className={`${styles.toggleTrack} ${narration ? styles.toggleOn : ''}`}>
                  <input
                    type="checkbox"
                    checked={narration}
                    onChange={e => setNarration(e.target.checked)}
                    className={styles.toggleInput}
                  />
                  <span className={styles.toggleThumb} />
                </div>
                <span className={styles.narrationLabel}>
                  AI Narration (TTS)
                  <span className={styles.narrationHint}>reads script aloud in the video</span>
                </span>
              </label>

              {narration && (
                <div className={styles.voiceGrid}>
                  {TTS_VOICES.map(v => (
                    <button
                      key={v.id}
                      className={`${styles.styleBtn} ${voice === v.id ? styles.styleBtnActive : ''}`}
                      onClick={() => setVoice(v.id)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {active && active.status !== 'done' && active.status !== 'error' && active.status !== 'cancelled' && (
            <div className={styles.activeWarning}>
              A generation is already in progress. <Link href="/video-creator/generations">View progress →</Link>
            </div>
          )}

          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={sceneList.length === 0 || (active && active.status === 'generating') || (active && active.status === 'recording')}
          >
            🎬 Generate Video
          </button>
        </div>
      </div>
    </div>
  );
}
