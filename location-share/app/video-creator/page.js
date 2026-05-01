'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGeneration } from '@/context/GenerationContext';
import Link from 'next/link';
import { STYLES, FORMATS, TTS_VOICES, splitScenes, sceneDurationFromText } from '@/lib/videoUtils';
import styles from './page.module.css';

export default function VideoCreator() {
  const router = useRouter();
  const { startGeneration, active } = useGeneration();
  const [script, setScript] = useState('');
  const [style, setStyle] = useState(STYLES[0].id);
  const [format, setFormat] = useState(FORMATS[0].id);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [narration, setNarration] = useState(false);
  const [voice, setVoice] = useState(TTS_VOICES[0].id);

  const sceneList = splitScenes(script);
  const estimatedDuration = Math.round(sceneList.reduce((s, scene) => s + sceneDurationFromText(scene.narration || scene.scenePrompt, speedMultiplier), 0));

  const handleGenerate = () => {
    if (!sceneList.length) return;
    startGeneration({ script, style, format, speedMultiplier, narration, voice });
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
            placeholder={`Write your script using S- for scene image and N- for narration.\n\nExample:\nS- A vast galaxy with swirling stars and a glowing black hole at its center\nN- Black holes are regions where gravity is so strong, nothing can escape.\n\nS- A massive star collapsing in a brilliant supernova explosion\nN- They form when massive stars reach the end of their life cycle.`}
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
              <label className={styles.settingLabel}>Format</label>
              <div className={styles.formatGrid}>
                {FORMATS.map(f => (
                  <button
                    key={f.id}
                    className={`${styles.formatBtn} ${format === f.id ? styles.formatBtnActive : ''}`}
                    onClick={() => setFormat(f.id)}
                  >
                    <span className={styles.formatIcon}>{f.icon}</span>
                    <span className={styles.formatLabel}>{f.label}</span>
                    <span className={styles.formatHint}>{f.hint}</span>
                  </button>
                ))}
              </div>
            </div>

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
                Pacing: <strong>{speedMultiplier === 0.5 ? 'Fast' : speedMultiplier === 1 ? 'Normal' : speedMultiplier === 1.5 ? 'Relaxed' : 'Slow'}</strong>
                <span style={{color:'var(--dim)',fontWeight:400}}> — durations scale with text length</span>
              </label>
              <input
                type="range" min={0.5} max={2} step={0.5} value={speedMultiplier}
                onChange={e => setSpeedMultiplier(Number(e.target.value))}
                className={styles.range}
              />
              <div className={styles.rangeLabels}><span>Fast</span><span>Slow</span></div>
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
