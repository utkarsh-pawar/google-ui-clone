export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
export const FPS = 30;

export const STYLES = [
  { id: 'cinematic', label: 'Cinematic', suffix: 'cinematic photography, dramatic lighting, film grain, professional' },
  { id: 'realistic', label: 'Realistic', suffix: 'photorealistic, high resolution, detailed, sharp' },
  { id: 'illustrated', label: 'Illustrated', suffix: 'digital illustration, vibrant colors, artistic, detailed artwork' },
  { id: 'documentary', label: 'Documentary', suffix: 'documentary photography, real, authentic, natural lighting' },
  { id: 'abstract', label: 'Abstract', suffix: 'abstract art, colorful, modern design, visual metaphor' },
];

export const TTS_VOICES = [
  { id: 'Brian', label: 'Brian (UK Male)' },
  { id: 'Amy', label: 'Amy (UK Female)' },
  { id: 'Joanna', label: 'Joanna (US Female)' },
  { id: 'Matthew', label: 'Matthew (US Male)' },
  { id: 'Joey', label: 'Joey (US Male)' },
];

export function splitScenes(script) {
  return script.split(/\n\n+/).map(s => s.trim()).filter(s => s.length > 20);
}

// Duration scales with word count: ~1.5s for a short phrase, up to 8s for a long paragraph
export function sceneDurationFromText(text, multiplier = 1) {
  const words = text.trim().split(/\s+/).length;
  const base = Math.max(1.5, Math.min(8, 1 + words * 0.15));
  return Math.round(base * multiplier * 10) / 10;
}

export function makeImagePrompt(text, styleSuffix) {
  const cleaned = text.replace(/[^\w\s,]/g, ' ').slice(0, 200);
  return `${cleaned}, ${styleSuffix}, 16:9 aspect ratio, high quality`;
}

export function pollinationsUrl(prompt) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${VIDEO_WIDTH}&height=${VIDEO_HEIGHT}&nologo=true&seed=${Math.floor(Math.random() * 9999)}`;
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Server rejected the request (possibly rate limited)'));
    img.src = url + '&t=' + Date.now();
    setTimeout(() => reject(new Error('Timed out after 60s — Pollinations may be busy')), 60000);
  });
}

export async function loadImageWithRetry(url, retries = 3) {
  let lastError = '';
  for (let i = 0; i < retries; i++) {
    try {
      return { img: await loadImage(url), error: null };
    } catch (err) {
      lastError = err.message;
      if (i < retries - 1) await sleep(2000 * (i + 1));
    }
  }
  return { img: null, error: `Failed after ${retries} attempts — ${lastError}` };
}

export async function fetchSceneAudio(text, voice = 'Brian') {
  try {
    const res = await fetch(`/api/tts?voice=${voice}&text=${encodeURIComponent(text.slice(0, 400))}`);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function drawSubtitle(ctx, text) {
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
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  const display = lines.slice(0, 3);

  const totalH = display.length * lineHeight + 32;
  const y = VIDEO_HEIGHT - totalH - 24;

  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, y - 8, VIDEO_WIDTH, totalH + 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;
  display.forEach((l, i) => ctx.fillText(l, VIDEO_WIDTH / 2, y + i * lineHeight + fontSize));
  ctx.shadowBlur = 0;
}

// sceneDurations: number (uniform) or number[] (per-scene). audioBuffers: ArrayBuffer[]|null[]
export async function renderVideo(scenes, sceneDurations, onProgress, audioBuffers = []) {
  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const ctx = canvas.getContext('2d');

  // Set up audio if any scene has audio
  const hasAudio = audioBuffers.some(Boolean);
  let audioCtx = null;
  let audioDest = null;
  const decodedAudio = [];

  if (hasAudio) {
    audioCtx = new AudioContext();
    audioDest = audioCtx.createMediaStreamDestination();
    for (let i = 0; i < scenes.length; i++) {
      if (audioBuffers[i]) {
        try {
          decodedAudio[i] = await audioCtx.decodeAudioData(audioBuffers[i].slice(0));
        } catch {
          decodedAudio[i] = null;
        }
      } else {
        decodedAudio[i] = null;
      }
    }
  }

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9' : 'video/webm';

  const canvasStream = canvas.captureStream(FPS);
  const allTracks = [...canvasStream.getTracks()];
  if (hasAudio && audioDest) allTracks.push(...audioDest.stream.getTracks());

  const stream = new MediaStream(allTracks);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.start(100);

  const FADE_MS = 400;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    onProgress(i + 1, scenes.length);

    // Per-scene or uniform duration; extend if TTS audio is longer
    const sceneDuration = Array.isArray(sceneDurations) ? sceneDurations[i] : sceneDurations;
    const audioDuration = decodedAudio[i]?.duration ?? 0;
    const effectiveDuration = Math.max(sceneDuration, audioDuration > 0 ? audioDuration + 0.8 : 0);
    const HOLD_MS = Math.max(300, effectiveDuration * 1000 - FADE_MS * 2);

    const drawFrame = (alpha) => {
      ctx.globalAlpha = 1;
      if (scene.image) ctx.drawImage(scene.image, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      else { ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT); }
      ctx.globalAlpha = 1 - alpha;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      ctx.globalAlpha = 1;
      drawSubtitle(ctx, scene.text);
    };

    const fadeFrames = Math.floor((FADE_MS / 1000) * FPS);

    // Start TTS audio after fade-in completes
    if (audioCtx && decodedAudio[i]) {
      const source = audioCtx.createBufferSource();
      source.buffer = decodedAudio[i];
      source.connect(audioDest);
      source.start(audioCtx.currentTime + FADE_MS / 1000);
    }

    for (let f = 0; f <= fadeFrames; f++) { drawFrame(f / fadeFrames); await sleep(1000 / FPS); }
    const holdFrames = Math.floor((HOLD_MS / 1000) * FPS);
    for (let f = 0; f < holdFrames; f++) { drawFrame(1); await sleep(1000 / FPS); }
    for (let f = fadeFrames; f >= 0; f--) { drawFrame(f / fadeFrames); await sleep(1000 / FPS); }
  }

  recorder.stop();
  if (audioCtx) audioCtx.close();

  return new Promise(resolve => {
    recorder.onstop = () => resolve(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })));
  });
}
