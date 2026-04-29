'use client';
import { useState, useRef, useCallback } from 'react';
import styles from './page.module.css';

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const FPS = 30;

const STYLES = [
  { id: 'cinematic', label: 'Cinematic', suffix: 'cinematic photography, dramatic lighting, film grain, professional' },
  { id: 'realistic', label: 'Realistic', suffix: 'photorealistic, high resolution, detailed, sharp' },
  { id: 'illustrated', label: 'Illustrated', suffix: 'digital illustration, vibrant colors, artistic, detailed artwork' },
  { id: 'documentary', label: 'Documentary', suffix: 'documentary photography, real, authentic, natural lighting' },
  { id: 'abstract', label: 'Abstract', suffix: 'abstract art, colorful, modern design, visual metaphor' },
];

function splitScenes(script) {
  return script
    .split(/\n\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);
}

function makeImagePrompt(text, styleSuffix) {
  const cleaned = text.replace(/[^\w\s,]/g, ' ').slice(0, 200);
  return `${cleaned}, ${styleSuffix}, 16:9 aspect ratio, high quality`;
}

function pollinationsUrl(prompt) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${VIDEO_WIDTH}&height=${VIDEO_HEIGHT}&nologo=true&seed=${Math.floor(Math.random() * 9999)}`;
}

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
    setTimeout(() => reject(new Error('Timeout')), 30000);
  });
}

function drawSubtitle(ctx, text, alpha = 1) {
  const padding = 48;
  const fontSize = 34;
  const maxWidth = VIDEO_WIDTH - padding * 2;
  const lineHeight = fontSize * 1.5;

  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = 'center';

  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const display = lines.slice(0, 3);

  const totalH = display.length * lineHeight + 32;
  const y = VIDEO_HEIGHT - totalH - 24;

  ctx.globalAlpha = alpha * 0.75;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, y - 8, VIDEO_WIDTH, totalH + 16);

  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;
  display.forEach((l, i) => {
    ctx.fillText(l, VIDEO_WIDTH / 2, y + i * lineHeight + fontSize);
  });
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function renderVideo(scenes, sceneDuration, onProgress) {
  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const ctx = canvas.getContext('2d');

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.start(100);

  const FADE_MS = 400;
  const HOLD_MS = Math.max(500, sceneDuration * 1000 - FADE_MS * 2);

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    onProgress(i + 1, scenes.length, 'recording');

    const drawFrame = (alpha) => {
      ctx.globalAlpha = 1;
      if (scene.image) {
        ctx.drawImage(scene.image, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      }
      ctx.globalAlpha = 1 - alpha;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      ctx.globalAlpha = 1;
      drawSubtitle(ctx, scene.text, alpha);
    };

    // Fade in
    const fadeFrames = Math.floor((FADE_MS / 1000) * FPS);
    for (let f = 0; f <= fadeFrames; f++) {
      drawFrame(f / fadeFrames);
      await sleep(1000 / FPS);
    }

    // Hold
    const holdFrames = Math.floor((HOLD_MS / 1000) * FPS);
    for (let f = 0; f < holdFrames; f++) {
      drawFrame(1);
      await sleep(1000 / FPS);
    }

    // Fade out
    for (let f = fadeFrames; f >= 0; f--) {
      drawFrame(f / fadeFrames);
      await sleep(1000 / FPS);
    }
  }

  recorder.stop();
  return new Promise(resolve => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(URL.createObjectURL(blob));
    };
  });
}

export default function VideoCreator() {
  const [script, setScript] = useState('');
  const [style, setStyle] = useState(STYLES[0].id);
  const [sceneDuration, setSceneDuration] = useState(4);
  const [status, setStatus] = useState('idle'); // idle | generating | recording | done | error
  const [scenes, setScenes] = useState([]);
  const [progress, setProgress] = useState({ step: '', current: 0, total: 0 });
  const [videoUrl, setVideoUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const abortRef = useRef(false);

  const sceneList = splitScenes(script);
  const estimatedDuration = sceneList.length * sceneDuration;

  const handleGenerate = useCallback(async () => {
    const rawScenes = splitScenes(script);
    if (rawScenes.length === 0) return;

    abortRef.current = false;
    setStatus('generating');
    setVideoUrl(null);
    setErrorMsg('');

    const selectedStyle = STYLES.find(s => s.id === style);

    // Step 1: generate images for all scenes
    const loadedScenes = rawScenes.map(text => ({ text, image: null, error: false }));
    setScenes([...loadedScenes]);

    await Promise.all(rawScenes.map(async (text, i) => {
      setProgress({ step: 'Generating images…', current: i + 1, total: rawScenes.length });
      const prompt = makeImagePrompt(text, selectedStyle.suffix);
      try {
        const img = await loadImage(pollinationsUrl(prompt));
        loadedScenes[i] = { text, image: img, error: false };
      } catch {
        // Use a fallback color image if load fails
        loadedScenes[i] = { text, image: null, error: true };
      }
      setScenes([...loadedScenes]);
    }));

    if (abortRef.current) { setStatus('idle'); return; }

    // Step 2: record video
    setStatus('recording');
    setProgress({ step: 'Recording video…', current: 0, total: rawScenes.length });

    try {
      const url = await renderVideo(loadedScenes, sceneDuration, (current, total) => {
        setProgress({ step: 'Recording video…', current, total });
      });
      setVideoUrl(url);
      setStatus('done');
    } catch (err) {
      setErrorMsg('Recording failed: ' + err.message);
      setStatus('error');
    }
  }, [script, style, sceneDuration]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = 'video.webm';
    a.click();
  };

  const reset = () => {
    setStatus('idle');
    setScenes([]);
    setVideoUrl(null);
    setProgress({ step: '', current: 0, total: 0 });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="/" className={styles.back}>← Back</a>
        <div className={styles.headerCenter}>
          <span className={styles.logo}>🎬</span>
          <div>
            <div className={styles.title}>Video Creator</div>
            <div className={styles.subtitle}>Script → YouTube video</div>
          </div>
        </div>
        <div style={{ width: 80 }} />
      </header>

      <div className={styles.body}>
        <div className={styles.left}>
          <div className={styles.sectionTitle}>Your Script</div>

          <textarea
            className={styles.textarea}
            placeholder={`Paste your YouTube script here. Each paragraph becomes one scene.\n\nExample:\nBlack holes are regions of spacetime where gravity is so strong that nothing can escape.\n\nThey form when massive stars collapse at the end of their life cycle.\n\nScientists detect black holes by observing their effect on nearby matter.`}
            value={script}
            onChange={e => setScript(e.target.value)}
            disabled={status === 'generating' || status === 'recording'}
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
                type="range"
                min={2}
                max={10}
                value={sceneDuration}
                onChange={e => setSceneDuration(Number(e.target.value))}
                className={styles.range}
              />
              <div className={styles.rangeLabels}><span>2s (fast)</span><span>10s (slow)</span></div>
            </div>
          </div>

          {status === 'idle' && (
            <button
              className={styles.generateBtn}
              onClick={handleGenerate}
              disabled={sceneList.length === 0}
            >
              🎬 Generate Video
            </button>
          )}

          {(status === 'generating' || status === 'recording') && (
            <div className={styles.progressBox}>
              <div className={styles.progressLabel}>
                {progress.step} {progress.current}/{progress.total}
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
              {status === 'recording' && (
                <div className={styles.recordingNote}>
                  Recording in real-time — this takes as long as the video (~{estimatedDuration}s)
                </div>
              )}
            </div>
          )}

          {status === 'done' && (
            <div className={styles.doneActions}>
              <button className={styles.downloadBtn} onClick={handleDownload}>
                ⬇ Download Video (.webm)
              </button>
              <button className={styles.resetBtn} onClick={reset}>
                Make Another
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className={styles.errorBox}>
              <span>⚠️ {errorMsg}</span>
              <button className={styles.resetBtn} onClick={reset}>Retry</button>
            </div>
          )}
        </div>

        <div className={styles.right}>
          {status === 'done' && videoUrl && (
            <div className={styles.videoWrap}>
              <div className={styles.sectionTitle}>Preview</div>
              <video src={videoUrl} controls className={styles.video} />
            </div>
          )}

          {scenes.length > 0 && (
            <div className={styles.sceneGrid}>
              <div className={styles.sectionTitle}>Scenes</div>
              <div className={styles.sceneCards}>
                {scenes.map((scene, i) => (
                  <div key={i} className={styles.sceneCard}>
                    <div className={styles.sceneImg}>
                      {scene.image ? (
                        <img src={scene.image.src} alt={`Scene ${i + 1}`} />
                      ) : scene.error ? (
                        <div className={styles.imgError}>⚠ Failed</div>
                      ) : (
                        <div className={styles.imgLoading}>
                          <div className={styles.spinner} />
                        </div>
                      )}
                    </div>
                    <div className={styles.sceneText}>
                      <span className={styles.sceneNum}>Scene {i + 1}</span>
                      <p>{scene.text.slice(0, 80)}{scene.text.length > 80 ? '…' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scenes.length === 0 && status === 'idle' && (
            <div className={styles.emptyRight}>
              <div className={styles.emptyIcon}>🎬</div>
              <div className={styles.emptyTitle}>Paste a script and hit Generate</div>
              <div className={styles.emptySub}>Each paragraph = one scene with a matching AI image</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
