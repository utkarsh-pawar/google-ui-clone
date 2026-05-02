'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGeneration } from '@/context/GenerationContext';
import Link from 'next/link';
import { STYLES, FORMATS, TTS_VOICES, splitScenes, sceneDurationFromText } from '@/lib/videoUtils';
import { getTodaysTopic, FINANCE_TOPICS } from '@/lib/financeTopics';
import styles from './page.module.css';

export default function VideoCreator() {
  const router = useRouter();
  const { startGeneration, active } = useGeneration();

  const [script, setScript] = useState('');
  const [titleText, setTitleText] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeDescription, setYoutubeDescription] = useState('');
  const [youtubeTags, setYoutubeTags] = useState([]);
  const [style, setStyle] = useState(STYLES[0].id);
  const [format, setFormat] = useState('portrait');
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [narration, setNarration] = useState(true);
  const [voice, setVoice] = useState(TTS_VOICES[0].id);
  const [generating, setGenerating] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(() => getTodaysTopic());

  const sceneList = splitScenes(script);
  const estimatedDuration = Math.round(
    sceneList.reduce((s, scene) => s + sceneDurationFromText(scene.narration || scene.scenePrompt, speedMultiplier), 0)
  );

  const handleAutoGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: selectedTopic.topic, angle: selectedTopic.angle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Immediately kick off full pipeline — no second click needed
      startGeneration({
        script: data.script || '',
        style,
        format,
        speedMultiplier,
        narration,
        voice,
        titleText: data.suggestedTitle || '',
        youtubeTitle: data.youtubeTitle || '',
        youtubeDescription: data.description || '',
        youtubeTags: data.tags || [],
      });
      router.push('/video-creator/generations');
    } catch (err) {
      alert(`Script generation failed:\n\n${err.message}`);
      setGenerating(false);
    }
  }, [selectedTopic, style, format, speedMultiplier, narration, voice, startGeneration, router]);

  const handleGenerate = () => {
    if (!sceneList.length) return;
    startGeneration({ script, style, format, speedMultiplier, narration, voice, titleText, youtubeTitle, youtubeDescription, youtubeTags });
    router.push('/video-creator/generations');
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>← Back</Link>
        <div className={styles.headerCenter}>
          <span className={styles.logo}>🎬</span>
          <div>
            <div className={styles.title}>Finance Video Creator</div>
            <div className={styles.subtitle}>Auto-generate · Record · Upload</div>
          </div>
        </div>
        <Link href="/video-creator/scheduler" className={styles.historyLink}>
          Scheduler →
        </Link>
      </header>

      <div className={styles.formBody}>
        {/* Auto-generate panel */}
        <div className={styles.autoPanel}>
          <div className={styles.autoPanelHeader}>
            <div>
              <div className={styles.autoPanelTitle}>⚡ Auto-Generate Script</div>
              <div className={styles.autoPanelSub}>Pick a topic → one click → video starts generating automatically</div>
            </div>
            <Link href="/video-creator/scheduler" className={styles.scheduleLink}>View Schedule →</Link>
          </div>

          <div className={styles.topicRow}>
            <select
              className={styles.topicSelect}
              value={selectedTopic.topic}
              onChange={e => setSelectedTopic(FINANCE_TOPICS.find(t => t.topic === e.target.value) || FINANCE_TOPICS[0])}
            >
              {FINANCE_TOPICS.map(t => (
                <option key={t.topic} value={t.topic}>{t.topic}</option>
              ))}
            </select>
            <button className={styles.autoBtn} onClick={handleAutoGenerate} disabled={generating}>
              {generating ? <><span className={styles.btnSpinner} /> Generating script…</> : '⚡ Auto Generate & Start'}
            </button>
          </div>

          {youtubeTitle && (
            <div className={styles.ytMeta}>
              <span className={styles.ytMetaLabel}>YouTube Title:</span>
              <span className={styles.ytMetaValue}>{youtubeTitle}</span>
            </div>
          )}
        </div>

        <div className={styles.formCard}>
          <div className={styles.sectionTitle}>Script</div>
          <input
            type="text"
            className={styles.titleInput}
            placeholder="Video title shown at top of first scene (optional)"
            value={titleText}
            onChange={e => setTitleText(e.target.value)}
            maxLength={80}
          />
          <textarea
            className={styles.textarea}
            placeholder={`S- A young person alone at 3AM, dim laptop glow\nN- While you slept, someone your age made ₹1,00,000.\n\nS- Bold text on dark: ONE SKILL\nN- One high-income skill. That's all it takes.`}
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
                  <button key={f.id}
                    className={`${styles.formatBtn} ${format === f.id ? styles.formatBtnActive : ''}`}
                    onClick={() => setFormat(f.id)}>
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
                  <button key={s.id}
                    className={`${styles.styleBtn} ${style === s.id ? styles.styleBtnActive : ''}`}
                    onClick={() => setStyle(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.settingRow}>
              <label className={styles.settingLabel}>
                Pacing: <strong>{speedMultiplier === 0.5 ? 'Fast' : speedMultiplier === 1 ? 'Normal' : speedMultiplier === 1.5 ? 'Relaxed' : 'Slow'}</strong>
              </label>
              <input type="range" min={0.5} max={2} step={0.5} value={speedMultiplier}
                onChange={e => setSpeedMultiplier(Number(e.target.value))} className={styles.range} />
              <div className={styles.rangeLabels}><span>Fast</span><span>Slow</span></div>
            </div>

            <div className={styles.settingRow}>
              <label className={styles.narrationToggle}>
                <div className={`${styles.toggleTrack} ${narration ? styles.toggleOn : ''}`}>
                  <input type="checkbox" checked={narration} onChange={e => setNarration(e.target.checked)} className={styles.toggleInput} />
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
                    <button key={v.id}
                      className={`${styles.styleBtn} ${voice === v.id ? styles.styleBtnActive : ''}`}
                      onClick={() => setVoice(v.id)}>
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {active && active.status !== 'done' && active.status !== 'error' && active.status !== 'cancelled' && (
            <div className={styles.activeWarning}>
              A generation is in progress. <Link href="/video-creator/generations">View progress →</Link>
            </div>
          )}

          <button className={styles.generateBtn} onClick={handleGenerate}
            disabled={sceneList.length === 0 || generating ||
              (active && (active.status === 'generating' || active.status === 'recording'))}>
            🎬 Generate Video
          </button>
        </div>
      </div>
    </div>
  );
}
