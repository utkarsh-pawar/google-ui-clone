'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useGeneration } from '@/context/GenerationContext';
import Link from 'next/link';
import { STYLES, FORMATS, TTS_VOICES, splitScenes, sceneDurationFromText } from '@/lib/videoUtils';
import { CHANNEL_DEFINITIONS, GENRES, getDefaultGenreForChannel } from '@/lib/financeTopics';
import styles from './page.module.css';

export default function ChannelVideoCreator() {
  const router = useRouter();
  const { channelId } = useParams();
  const searchParams = useSearchParams();
  const { startGeneration, active } = useGeneration();
  const autoTriggered = useRef(false);

  const channel = CHANNEL_DEFINITIONS.find(c => c.id === channelId) || CHANNEL_DEFINITIONS[0];
  const channelGenres = GENRES.filter(g => channel.genres.includes(g.id));
  const defaultGenre = getDefaultGenreForChannel(channelId);

  const HINDI_GENRES = ['chants', 'wisdom', 'chanakya', 'religious'];
  const [genre, setGenre] = useState(defaultGenre);
  const [format, setFormat] = useState('portrait');
  const [language, setLanguage] = useState(HINDI_GENRES.includes(defaultGenre) ? 'hi' : 'en');
  const [showSubtitles, setShowSubtitles] = useState(true);

  // Trending ideas state
  const [ideas, setIdeas] = useState([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState(null);

  // Script generation state
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

  // Character registry — locked appearance descriptions injected into every scene image prompt
  const [characters, setCharacters] = useState([]);
  const addCharacter = () => setCharacters(c => [...c, { name: '', appearance: '', outfit: '' }]);
  const removeCharacter = (i) => setCharacters(c => c.filter((_, j) => j !== i));
  const updateCharacter = (i, field, val) => setCharacters(c => c.map((ch, j) => j === i ? { ...ch, [field]: val } : ch));

  const sceneList = splitScenes(script);
  const estimatedDuration = Math.round(
    sceneList.reduce((s, scene) => s + sceneDurationFromText(scene.narration || scene.scenePrompt, speedMultiplier), 0)
  );

  const handleGenreChange = (g) => {
    setGenre(g);
    setIdeas([]);
    setSelectedIdea(null);
    setPendingScript(null);
    setTitleOptions(null);
    // Auto-switch to Hindi for spiritual genres
    if (HINDI_GENRES.includes(g)) setLanguage('hi');
    else if (HINDI_GENRES.includes(genre)) setLanguage('en'); // switching away from Hindi genre
  };

  const handleFetchIdeas = useCallback(async () => {
    setLoadingIdeas(true);
    setIdeas([]);
    setSelectedIdea(null);
    setPendingScript(null);
    setTitleOptions(null);
    try {
      const res = await fetch('/api/trending-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genre, channelId, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIdeas(data.ideas || []);
    } catch (err) {
      alert(`Failed to fetch ideas:\n\n${err.message}`);
    } finally {
      setLoadingIdeas(false);
    }
  }, [genre, channelId, language]);

  const handlePickIdea = useCallback(async (idea) => {
    setSelectedIdea(idea);
    setPendingScript(null);
    setTitleOptions(null);
    setGenerating(true);
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: idea.topic, angle: idea.angle, genre, format, language, characters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingScript(data);
      setTitleOptions(data.titleOptions?.length ? data.titleOptions : [data.youtubeTitle || idea.topic]);
    } catch (err) {
      alert(`Script generation failed:\n\n${err.message}`);
      setSelectedIdea(null);
    } finally {
      setGenerating(false);
    }
  }, [genre, format, language]);

  const handleStartWithTitle = useCallback((title) => {
    startGeneration({
      script: pendingScript.script || '',
      style, format, language, speedMultiplier, narration, voice, genre, showSubtitles,
      titleText: pendingScript.suggestedTitle || '',
      youtubeTitle: title,
      youtubeDescription: pendingScript.description || '',
      youtubeTags: pendingScript.tags || [],
      channelId, characters,
    });
    router.push('/video-creator/generations');
  }, [pendingScript, style, format, language, speedMultiplier, narration, voice, startGeneration, router, channelId, characters]);

  // Auto-trigger from Insights page: ?topic=...&angle=...
  useEffect(() => {
    const topic = searchParams.get('topic');
    const angle = searchParams.get('angle');
    if (topic && !autoTriggered.current) {
      autoTriggered.current = true;
      handlePickIdea({ topic, angle: angle || 'history' });
    }
  }, [searchParams, handlePickIdea]);

  const handleGenerate = () => {
    if (!sceneList.length) return;
    startGeneration({ script, style, format, language, speedMultiplier, narration, voice, genre, showSubtitles, titleText, youtubeTitle, youtubeDescription, youtubeTags, channelId, characters });
    router.push('/video-creator/generations');
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/video-creator" className={styles.back}>← Channels</Link>
        <div className={styles.headerCenter}>
          <span className={styles.logo}>{channel.icon}</span>
          <div>
            <div className={styles.title}>{channel.name}</div>
            <div className={styles.subtitle}>Auto-generate · Record · Upload</div>
          </div>
        </div>
        <div className={styles.headerLinks}>
          <Link href={`/video-creator/${channelId}/insights`} className={styles.historyLink}>Insights →</Link>
          <Link href={`/video-creator/${channelId}/scheduler`} className={styles.historyLink}>Scheduler →</Link>
        </div>
      </header>

      <div className={styles.formBody}>
        <div className={styles.autoPanel}>
          <div className={styles.autoPanelHeader}>
            <div className={styles.autoPanelTitle}>⚡ Auto-Generate</div>
            <Link href={`/video-creator/${channelId}/scheduler`} className={styles.scheduleLink}>Schedule →</Link>
          </div>

          {/* Genre */}
          <div className={styles.autoSection}>
            <div className={styles.autoLabel}>Genre</div>
            <div className={styles.genreGrid}>
              {channelGenres.map(g => (
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

          {/* Language */}
          <div className={styles.autoSection}>
            <div className={styles.autoLabel}>Language</div>
            <div className={styles.formatToggle}>
              {[{ id: 'en', label: '🇬🇧 English' }, { id: 'hi', label: '🇮🇳 Hindi' }].map(l => (
                <button
                  key={l.id}
                  className={`${styles.formatToggleBtn} ${language === l.id ? styles.formatToggleBtnActive : ''}`}
                  onClick={() => { setLanguage(l.id); setIdeas([]); setSelectedIdea(null); setPendingScript(null); setTitleOptions(null); }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trending Ideas */}
          <div className={styles.autoSection}>
            <div className={styles.trendingHeader}>
              <div className={styles.autoLabel}>Trending Ideas</div>
              {ideas.length > 0 && (
                <button className={styles.refreshBtn} onClick={handleFetchIdeas} disabled={loadingIdeas}>
                  {loadingIdeas ? '…' : '↻ Refresh'}
                </button>
              )}
            </div>

            {ideas.length === 0 ? (
              <button className={styles.fetchIdeasBtn} onClick={handleFetchIdeas} disabled={loadingIdeas}>
                {loadingIdeas
                  ? <><span className={styles.btnSpinner} /> Finding what&apos;s trending in 2026…</>
                  : '🔥 Get 10 Trending Ideas'}
              </button>
            ) : (
              <div className={styles.ideasGrid}>
                {ideas.map((idea, i) => (
                  <button
                    key={i}
                    className={`${styles.ideaCard} ${selectedIdea?.topic === idea.topic ? styles.ideaCardActive : ''}`}
                    onClick={() => !generating && handlePickIdea(idea)}
                    disabled={generating}
                  >
                    <div className={styles.ideaTop}>
                      <span className={styles.ideaNum}>{i + 1}</span>
                      <span className={styles.ideaAngle}>{idea.angle}</span>
                    </div>
                    <div className={styles.ideaTopic}>{idea.topic}</div>
                    <div className={styles.ideaHook}>"{idea.hook}"</div>
                    <div className={styles.ideaWhy}>📈 {idea.whyTrending}</div>
                    {selectedIdea?.topic === idea.topic && generating && (
                      <div className={styles.ideaGenerating}><span className={styles.btnSpinner} /> Writing script…</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title options after idea picked */}
          {titleOptions && (
            <div className={styles.autoSection}>
              <div className={styles.autoLabel}>Pick a title to create the video</div>
              <div className={styles.titleOptions}>
                {titleOptions.map((t, i) => (
                  <button key={i} className={styles.titleOptionBtn} onClick={() => handleStartWithTitle(t)}>
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

          {/* Character Registry */}
          <div className={styles.charPanel}>
            <div className={styles.charPanelHeader}>
              <div className={styles.charPanelTitle}>
                🎭 Characters
                <span className={styles.charPanelHint}>locked appearance → consistent AI images</span>
              </div>
              <button className={styles.charAddBtn} onClick={addCharacter}>+ Add</button>
            </div>
            {characters.length === 0 && (
              <div className={styles.charEmpty}>
                Add characters to lock their appearance across all scenes. Use <code>N-[name]</code> in your script.
              </div>
            )}
            {characters.map((char, i) => (
              <div key={i} className={styles.charRow}>
                <input
                  className={styles.charNameInput}
                  placeholder="name (e.g. priya)"
                  value={char.name}
                  onChange={e => updateCharacter(i, 'name', e.target.value)}
                />
                <input
                  className={styles.charAppearanceInput}
                  placeholder="appearance (e.g. Indian woman 26, straight black hair, brown eyes, determined face)"
                  value={char.appearance}
                  onChange={e => updateCharacter(i, 'appearance', e.target.value)}
                />
                <input
                  className={styles.charOutfitInput}
                  placeholder="outfit (e.g. blue delivery jacket)"
                  value={char.outfit}
                  onChange={e => updateCharacter(i, 'outfit', e.target.value)}
                />
                <button className={styles.charRemoveBtn} onClick={() => removeCharacter(i)}>×</button>
              </div>
            ))}
          </div>

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

            <div className={styles.settingRow}>
              <label className={styles.narrationToggle}>
                <div className={`${styles.toggleTrack} ${showSubtitles ? styles.toggleOn : ''}`}>
                  <input type="checkbox" checked={showSubtitles} onChange={e => setShowSubtitles(e.target.checked)} className={styles.toggleInput} />
                  <span className={styles.toggleThumb} />
                </div>
                <span className={styles.narrationLabel}>
                  Subtitles
                  <span className={styles.narrationHint}>show text overlay on video</span>
                </span>
              </label>
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
