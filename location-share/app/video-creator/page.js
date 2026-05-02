'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGeneration } from '@/context/GenerationContext';
import Link from 'next/link';
import { STYLES, FORMATS, TTS_VOICES, splitScenes, sceneDurationFromText } from '@/lib/videoUtils';
import { getTodaysTopic, getTopicsByGenre, GENRES } from '@/lib/financeTopics';
import styles from './page.module.css';

export default function VideoCreator() {
  const router = useRouter();
  const { startGeneration, active } = useGeneration();

  // Auto-generate state
  const [genre, setGenre] = useState('motivation');
  const [format, setFormat] = useState('portrait');
  const [selectedTopic, setSelectedTopic] = useState(() => getTodaysTopic());
  const [generating, setGenerating] = useState(false);
  const [pendingScript, setPendingScript] = useState(null);
  const [titleOptions, setTitleOptions] = useState(null);

  // Manual script state
  const [script, setScript] = useState('');
  const [titleText, setTitleText] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeDescription, setYoutubeDescription] = useState('');
  const [youtubeTags, setYoutubeTags] = useState([]);
  const [style, setStyle] = useState(STYLES[0].id);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [narration, setNarration] = useState(true);
  const [voice, setVoice] = useState(TTS_VOICES[0].id);

  const topicsForGenre = getTopicsByGenre(genre);
  const sceneList = splitScenes(script);
  const maxSecPerScene = format === 'portrait' ? 8 : 20;
  const estimatedDuration = Math.round(
    sceneList.reduce((s, scene) => s + sceneDurationFromText(scene.narration || scene.scenePrompt, speedMultiplier, maxSecPerScene), 0)
  );

  const handleGenreChange = (g) => {
    setGenre(g);
    setPendingScript(null);
    setTitleOptions(null);
    const topics = getTopicsByGenre(g);
    setSelectedTopic(topics[0] || getTodaysTopic());
  };

  const handleGenerateTitles = useCallback(async () => {
    setGenerating(true);
    setPendingScript(null);
    setTitleOptions(null);
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: selectedTopic.topic, angle: selectedTopic.angle, genre, format }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingScript(data);
      setTitleOptions(data.titleOptions?.length ? data.titleOptions : [data.youtubeTitle || selectedTopic.topic]);
    } catch (err) {
      alert(`Script generation failed:\n\n${err.message}`);
    } finally {
      setGenerating(false);
    }
  }, [selectedTopic, genre, format]);

  const handleStartWithTitle = useCallback((title) => {
    startGeneration({
      script: pendingScript.script || '',
      style,
      format,
      speedMultiplier,
      narration,
      voice,
      titleText: pendingScript.suggestedTitle || '',
      youtubeTitle: title,
      youtubeDescription: pendingScript.description || '',
      youtubeTags: pendingScript.tags || [],
    });
    router.push('/video-creator/generations');
  }, [pendingScript, style, format, speedMultiplier, narration, voice, startGeneration, router]);

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
        <Link href="/video-creator/scheduler" className={styles.historyLink}>Scheduler →</Link>
      </header>

      <div className={styles.formBody}>
        {/* Auto-generate panel */}
        <div className={styles.autoPanel}>
          <div className={styles.autoPanelHeader}>
            <div className={styles.autoPanelTitle}>⚡ Auto-Generate</div>
            <Link href="/video-creator/scheduler" className={styles.scheduleLink}>Schedule →</Link>
          </div>

          {/* Genre */}
          <div className={styles.autoSection}>
            <div className={styles.autoLabel}>Genre</div>
            <div className={styles.genreGrid}>
              {GENRES.map(g => (
                <button
                  key={g.id}
                  className={`${styles.genreBtn} ${genre === g.id ? styles.genreBtnActive : ''}`}
                  onClick={() => handleGenreChange(g.id)}
                >
                  <span className={styles.genreLabel}>{g.label}</span>
                  <span className={styles.genreDesc}>{g.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div className={styles.autoSection}>
            <div className={styles.autoLabel}>Format</div>
            <div className={styles.formatToggle}>
              {FORMATS.map(f => (
                <button
                  key={f.id}
                  className={`${styles.formatToggleBtn} ${format === f.id ? styles.formatToggleBtnActive : ''}`}
                  onClick={() => { setFormat(f.id); setPendingScript(null); setTitleOptions(null); }}
                >
                  {f.icon} {f.label}
                  <span className={styles.formatHint}>{f.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Topic + Generate */}
          <div className={styles.autoSection}>
            <div className={styles.autoLabel}>Topic</div>
            <div className={styles.topicRow}>
              <select
                className={styles.topicSelect}
                value={selectedTopic.topic}
                onChange={e => {
                  const found = topicsForGenre.find(t => t.topic === e.target.value);
                  if (found) { setSelectedTopic(found); setPendingScript(null); setTitleOptions(null); }
                }}
              >
                {topicsForGenre.map(t => (
                  <option key={t.topic} value={t.topic}>{t.topic}</option>
                ))}
              </select>
              <button className={styles.autoBtn} onClick={handleGenerateTitles} disabled={generating}>
                {generating
                  ? <><span className={styles.btnSpinner} /> Generating…</>
                  : '✨ Generate Titles'}
              </button>
            </div>
          </div>

          {/* Title options — shown after generation */}
          {titleOptions && (
            <div className={styles.autoSection}>
              <div className={styles.autoLabel}>Pick a title to use</div>
              <div className={styles.titleOptions}>
                {titleOptions.map((t, i) => (
                  <button
                    key={i}
                    className={styles.titleOptionBtn}
                    onClick={() => handleStartWithTitle(t)}
                  >
                    <span className={styles.titleOptionNum}>{i + 1}</span>
                    <span className={styles.titleOptionText}>{t}</span>
                    <span className={styles.titleOptionArrow}>▶</span>
                  </button>
                ))}
              </div>
              <div className={styles.titleOptionHint}>Tap a title to start generating the video</div>
            </div>
          )}
        </div>

        {/* Manual script card */}
        <div className={styles.formCard}>
          <div className={styles.sectionTitle}>Manual Script</div>
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
