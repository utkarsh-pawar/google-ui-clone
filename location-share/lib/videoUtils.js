export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
export const FPS = 30;

export const FORMATS = [
  { id: 'landscape', label: 'YouTube Video', hint: '16:9', width: 1280, height: 720,  icon: '🖥' },
  { id: 'portrait',  label: 'YouTube Shorts', hint: '9:16', width: 1080, height: 1920, icon: '📱' },
];

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

// Characters that map to male voices
const MALE_CHARS = new Set(['ramesh','ram','suresh','mohan','rajesh','raj','papa','father','baba','dada','beta','anil','rahul','vikram','arjun','ravi','deepak','ajay','amit','nikhil','rohit','vivek']);
// Characters that map to female voices
const FEMALE_CHARS = new Set(['sunita','sita','seema','mama','mother','priya','anita','meena','kavita','pooja','didi','rani','devi','nani','rekha','geeta','neha','ritu','kavya','lalita']);

export function getCharacterGender(character) {
  const lc = (character || '').toLowerCase().trim();
  if (MALE_CHARS.has(lc)) return 'male';
  if (FEMALE_CHARS.has(lc)) return 'female';
  return 'narrator';
}

export function splitScenes(script) {
  const hasFormat = /^[SsNn]-/m.test(script);

  if (!hasFormat) {
    // Backward compatible: each paragraph is both scene prompt and narration
    return script
      .split(/\n\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 2)
      .map(text => ({ scenePrompt: text, narration: text, character: '' }));
  }

  // S- line = image generation prompt
  // N- line = TTS narration + subtitle (optionally tagged: N-[character] text)
  const scenes = [];
  let scenePrompt = '';
  let narration = '';
  let character = '';

  for (const line of script.split('\n')) {
    const t = line.trim();
    if (/^[Ss]-\s*/i.test(t)) {
      if (scenePrompt) scenes.push({ scenePrompt, narration: narration || scenePrompt, character });
      scenePrompt = t.replace(/^[Ss]-\s*/i, '').trim();
      narration = '';
      character = '';
    } else if (/^[Nn]-\s*/i.test(t)) {
      const raw = t.replace(/^[Nn]-\s*/i, '').trim();
      // N-[character] text OR N- text
      const charMatch = raw.match(/^\[([^\]]+)\]\s*([\s\S]*)/);
      if (charMatch) {
        character = charMatch[1].toLowerCase().trim();
        narration = charMatch[2].trim();
      } else {
        character = '';
        narration = raw;
      }
    }
  }
  if (scenePrompt) scenes.push({ scenePrompt, narration: narration || scenePrompt, character });

  return scenes.filter(s => s.scenePrompt.length > 0);
}

// Duration scales with word count: ~1.5s for a short phrase, up to 8s for a long paragraph
export function sceneDurationFromText(text, multiplier = 1) {
  const words = text.trim().split(/\s+/).length;
  const base = Math.max(1.5, Math.min(8, 1 + words * 0.15));
  return Math.round(base * multiplier * 10) / 10;
}

// Visual hints appended when a named character is speaking — steers AI toward character scenes
const CHARACTER_APPEARANCE = {
  ramesh:  'Indian man 40s, tired weathered face, worn kurta, poor household setting',
  sunita:  'Indian woman 35, simple cotton saree, strong determined expression',
  priya:   'Indian girl 10 years, school uniform, bright curious eyes',
  raja:    'Indian man 50s, dhoti kurta, simple rural setting',
  sita:    'Indian woman 40s, simple saree, traditional household',
};

export function makeImagePrompt(text, styleSuffix, format = FORMATS[0], isHook = false, character = '') {
  const cleaned = text.replace(/[^\w\s,]/g, ' ').slice(0, 200);
  const aspect = format.id === 'portrait' ? '9:16 aspect ratio, vertical composition, portrait orientation' : '16:9 aspect ratio';
  const hookMod = isHook ? ', extreme close-up, dramatic lighting, high contrast, cinematic tension, sharp focus' : '';
  const charDesc = character && CHARACTER_APPEARANCE[character.toLowerCase()]
    ? `, ${CHARACTER_APPEARANCE[character.toLowerCase()]}, digital illustration warm colors, character interaction scene`
    : character && !isHook
      ? ', character dialogue scene, digital illustration style, warm colors, expressive faces'
      : '';
  return `${cleaned}${charDesc}, ${styleSuffix}${hookMod}, ${aspect}, high quality`;
}

// Routes through our server. idx used to alternate between sources for rate-limit cooldown.
export function pollinationsUrl(prompt, width = VIDEO_WIDTH, height = VIDEO_HEIGHT, idx = 0) {
  return `/api/image?prompt=${encodeURIComponent(prompt)}&width=${width}&height=${height}&idx=${idx}`;
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image proxy failed — Pollinations may be down or rate-limited'));
    img.src = url;
    setTimeout(() => reject(new Error('Timed out after 60s')), 60000);
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

// Load a video element from a URL (for animated reel scenes)
export async function loadVideoClip(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    const timer = setTimeout(() => reject(new Error('Video clip timeout')), timeout);
    vid.oncanplay = () => { clearTimeout(timer); resolve(vid); };
    vid.onerror = () => { clearTimeout(timer); reject(new Error('Video clip failed')); };
    vid.src = url;
    vid.load();
  });
}

// Generate a YouTube thumbnail from the first good scene image
export async function generateThumbnail(image, title, format) {
  const W = format.width;
  const H = format.height;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  if (image) {
    ctx.drawImage(image, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, W, H);
  }

  // Dark gradient over bottom 55%
  const grad = ctx.createLinearGradient(0, H * 0.42, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.7)');
  grad.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Title text — large, bold, left-aligned with padding
  const fontSize = format.id === 'portrait' ? Math.round(W * 0.075) : Math.round(W * 0.055);
  const pad = Math.round(W * 0.05);
  const maxWidth = W - pad * 2;
  ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 16;

  const words = title.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);

  const lineH = fontSize * 1.25;
  const totalTextH = lines.length * lineH;
  const startY = H - totalTextH - pad * 1.5;
  lines.forEach((l, i) => ctx.fillText(l, pad, startY + i * lineH + fontSize));

  // #SHORTS badge for portrait
  if (format.id === 'portrait') {
    const bh = Math.round(H * 0.045);
    const bpad = Math.round(W * 0.04);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.roundRect(pad, H * 0.04, bpad * 2 + ctx.measureText('#SHORTS').width, bh + bpad, 6);
    ctx.fill();
    ctx.font = `800 ${Math.round(bh * 0.7)}px -apple-system, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.fillText('#SHORTS', pad + bpad, H * 0.04 + bh * 0.85);
  }

  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.93));
}

/**
 * Process items in concurrent batches with per-item retry.
 * Mimics BullMQ worker behaviour (concurrency + retries) without Redis.
 *
 * processor(item, index, attempt) should throw on failure.
 * onItemDone(index, data, errorMsg) called as each item finishes/fails.
 */
export async function processInBatches(items, processor, {
  batchSize = 2,
  retries = 3,
  retryDelay = 2000,  // ms; doubles each attempt
  batchDelay = 400,   // ms between batches
  abortRef = null,
  onItemDone = null,
} = {}) {
  const results = new Array(items.length);

  for (let start = 0; start < items.length; start += batchSize) {
    if (abortRef?.current) break;

    const indices = Array.from(
      { length: Math.min(batchSize, items.length - start) },
      (_, j) => start + j,
    );

    await Promise.all(indices.map(async idx => {
      let lastErr = null;
      for (let attempt = 0; attempt < retries; attempt++) {
        if (abortRef?.current) return;
        try {
          const data = await processor(items[idx], idx, attempt);
          results[idx] = { ok: true, data };
          onItemDone?.(idx, data, null);
          return;
        } catch (err) {
          lastErr = err.message ?? String(err);
          if (attempt < retries - 1) await sleep(retryDelay * (attempt + 1));
        }
      }
      results[idx] = { ok: false, error: lastErr };
      onItemDone?.(idx, null, lastErr);
    }));

    if (start + batchSize < items.length) await sleep(batchDelay);
  }

  return results;
}

export async function fetchSceneAudio(text, voice = 'Brian', lang = 'en', character = '') {
  try {
    const res = await fetch(
      `/api/tts?voice=${voice}&lang=${lang}&text=${encodeURIComponent(text.slice(0, 400))}&character=${encodeURIComponent(character)}`
    );
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

// Cinematic vignette — darkens edges for all scenes
function drawVignette(ctx, W, H) {
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.8);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.52)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// Warm urgency tint — applied only on hook scene (scene 0)
function drawHookGrade(ctx, W, H) {
  ctx.fillStyle = 'rgba(220,55,0,0.07)';
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, H * 0.65, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// progress: 0→1 within the scene — drives subtitle slide-up + fade-in
function drawSubtitle(ctx, text, W, H, progress = 1, isHook = false) {
  const padding = 48;
  const fontSize = isHook ? (W < 900 ? 44 : 40) : (W < 900 ? 38 : 34);
  const fontWeight = isHook ? '700' : '600';
  const maxWidth = W - padding * 2;
  const lineHeight = fontSize * 1.5;

  ctx.font = `${fontWeight} ${fontSize}px 'Noto Sans Devanagari', 'Mangal', -apple-system, BlinkMacSystemFont, sans-serif`;
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
  const slideOffset = Math.round((1 - Math.min(progress * 4, 1)) * 20);
  const y = H - totalH - 24 + slideOffset;
  const alpha = Math.min(progress * 5, 1);

  ctx.save();
  ctx.globalAlpha = alpha * 0.78;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, y - 8, W, totalH + 16);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;
  display.forEach((l, i) => ctx.fillText(l, W / 2, y + i * lineHeight + fontSize));
  ctx.restore();
}

// Cinematic hook title — centered stroke text, positioned in upper-center of frame
function drawHookTitle(ctx, text, W, H) {
  if (!text) return;
  const fontSize = W < 900 ? 52 : 46;
  const padding = 52;
  const maxWidth = W - padding * 2;
  const lineHeight = fontSize * 1.25;

  ctx.save();
  ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Arial Black', sans-serif`;
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

  const totalTextH = display.length * lineHeight;
  const topY = H * 0.28 - totalTextH / 2;

  // Thick black stroke for legibility against any background
  ctx.strokeStyle = 'rgba(0,0,0,0.92)';
  ctx.lineWidth = Math.round(fontSize * 0.14);
  ctx.lineJoin = 'round';
  display.forEach((l, idx) => ctx.strokeText(l, W / 2, topY + fontSize + idx * lineHeight));

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 20;
  display.forEach((l, idx) => ctx.fillText(l, W / 2, topY + fontSize + idx * lineHeight));

  ctx.restore();
}

// sceneDurations: number (uniform) or number[] (per-scene). audioBuffers: ArrayBuffer[]|null[]
export async function renderVideo(scenes, sceneDurations, onProgress, audioBuffers = [], format = FORMATS[0], scriptTitle = '') {
  const W = format.width;
  const H = format.height;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Set up audio if any scene has audio
  const hasAudio = audioBuffers.some(Boolean);
  let audioCtx = null;
  let audioDest = null;
  const decodedAudio = [];

  if (hasAudio) {
    audioCtx = new AudioContext();
    // Mobile browsers suspend AudioContext until resumed explicitly
    if (audioCtx.state === 'suspended') await audioCtx.resume();
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

  // Ken Burns effects: [startScale, endScale, startTX, endTX, startTY, endTY]
  // TX/TY are fractions of W/H — kept within zoom margin so no empty edges show
  const KB_EFFECTS = [
    [1.00, 1.08,  0,     0,     0,     0    ], // zoom in
    [1.08, 1.00,  0,     0,     0,     0    ], // zoom out
    [1.06, 1.06,  0.02, -0.02,  0,     0    ], // pan left
    [1.06, 1.06, -0.02,  0.02,  0,     0    ], // pan right
    [1.06, 1.08,  0.01, -0.01,  0.01, -0.01 ], // zoom in + drift up-left
    [1.08, 1.05, -0.01,  0.01, -0.01,  0.01 ], // zoom out + drift down-right
  ];
  // Hook scene gets an aggressive zoom-in with slight drift — creates tension
  const HOOK_KB = [1.00, 1.15, 0.007, -0.007, 0.004, -0.004];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    onProgress(i + 1, scenes.length);

    // Per-scene or uniform duration; extend if TTS audio is longer
    const sceneDuration = Array.isArray(sceneDurations) ? sceneDurations[i] : sceneDurations;
    const audioDuration = decodedAudio[i]?.duration ?? 0;
    const effectiveDuration = Math.min(
      Math.max(sceneDuration, audioDuration > 0 ? audioDuration + 0.8 : 0),
      15
    );
    const HOLD_MS = Math.max(300, effectiveDuration * 1000 - FADE_MS * 2);

    const fadeFrames = Math.floor((FADE_MS / 1000) * FPS);
    const holdFrames = Math.floor((HOLD_MS / 1000) * FPS);
    const totalFrames = (fadeFrames + 1) * 2 + holdFrames;
    const [s0, s1, x0, x1, y0, y1] = i === 0 ? HOOK_KB : KB_EFFECTS[i % KB_EFFECTS.length];
    let sceneFrame = 0;

    // Start video clip playing if this scene has one
    if (scene.videoEl) {
      scene.videoEl.currentTime = 0;
      scene.videoEl.play().catch(() => {});
    }

    const drawFrame = (alpha) => {
      const p = totalFrames > 1 ? sceneFrame / (totalFrames - 1) : 0;
      const t = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;

      ctx.clearRect(0, 0, W, H);

      if (scene.videoEl) {
        // Animated reel: draw live video frame — slight zoom for cinematic feel
        ctx.save();
        const vscale = 1.04;
        ctx.translate(W / 2, H / 2);
        ctx.scale(vscale, vscale);
        ctx.translate(-W / 2, -H / 2);
        ctx.drawImage(scene.videoEl, 0, 0, W, H);
        ctx.restore();
      } else if (scene.image) {
        // Static image with Ken Burns
        const scale = s0 + (s1 - s0) * t;
        const tx = (x0 + (x1 - x0) * t) * W;
        const ty = (y0 + (y1 - y0) * t) * H;
        ctx.save();
        ctx.translate(W / 2 + tx, H / 2 + ty);
        ctx.scale(scale, scale);
        ctx.translate(-W / 2, -H / 2);
        ctx.drawImage(scene.image, 0, 0, W, H);
        ctx.restore();
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);
      }

      // Cinematic post-processing (before fade so they dissolve with the scene)
      drawVignette(ctx, W, H);
      if (i === 0) drawHookGrade(ctx, W, H);

      // Black fade overlay between scenes
      ctx.globalAlpha = 1 - alpha;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;

      // Subtitle with slide-up animation (p = scene progress 0→1)
      drawSubtitle(ctx, scene.narration || scene.text || '', W, H, p, i === 0);
      if (i === 0 && scriptTitle) drawHookTitle(ctx, scriptTitle, W, H);
      sceneFrame++;
    };

    // Start TTS audio after fade-in completes
    if (audioCtx && decodedAudio[i]) {
      const source = audioCtx.createBufferSource();
      source.buffer = decodedAudio[i];
      source.connect(audioDest);
      source.start(audioCtx.currentTime + FADE_MS / 1000);
    }

    for (let f = 0; f <= fadeFrames; f++) { drawFrame(f / fadeFrames); await sleep(1000 / FPS); }
    for (let f = 0; f < holdFrames; f++) { drawFrame(1); await sleep(1000 / FPS); }
    for (let f = fadeFrames; f >= 0; f--) { drawFrame(f / fadeFrames); await sleep(1000 / FPS); }
  }

  recorder.stop();
  if (audioCtx) audioCtx.close();

  return new Promise(resolve => {
    recorder.onstop = () => resolve(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })));
  });
}
