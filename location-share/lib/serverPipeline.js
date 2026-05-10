// Server-side Auto Studio pipeline — runs entirely on Vercel, no browser needed.
// Script → images → audio → FFmpeg → YouTube upload → Redis job log.
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import ffmpegBin from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

// ── Redis ────────────────────────────────────────────────────────────────────
function getRedisConfig() {
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

async function redisCmd(...args) {
  const cfg = getRedisConfig();
  if (!cfg) return null;
  const res = await fetch(
    `${cfg.url}/${args.map(a => encodeURIComponent(String(a))).join('/')}`,
    { headers: { Authorization: `Bearer ${cfg.token}` } }
  );
  return (await res.json()).result;
}

// ── Job tracking ─────────────────────────────────────────────────────────────
export async function saveJob(jobId, data) {
  try {
    await redisCmd('SET', `studio_job:${jobId}`, JSON.stringify(data), 'EX', 604800); // 7 days
    await redisCmd('LPUSH', 'studio_jobs', jobId);
    await redisCmd('LTRIM', 'studio_jobs', 0, 29);
  } catch {}
}

export async function updateJob(jobId, updates) {
  try {
    const raw = await redisCmd('GET', `studio_job:${jobId}`);
    const existing = raw ? JSON.parse(raw) : {};
    await redisCmd('SET', `studio_job:${jobId}`, JSON.stringify({ ...existing, ...updates }), 'EX', 604800);
  } catch {}
}

export async function getRecentJobs() {
  try {
    const ids = await redisCmd('LRANGE', 'studio_jobs', 0, 14);
    if (!ids?.length) return [];
    const jobs = await Promise.all(
      ids.map(async id => {
        const raw = await redisCmd('GET', `studio_job:${id}`);
        return raw ? JSON.parse(raw) : null;
      })
    );
    return jobs.filter(Boolean);
  } catch { return []; }
}

// ── Studio config ────────────────────────────────────────────────────────────
export async function getStudioConfig() {
  try {
    const raw = await redisCmd('GET', 'studio_config');
    return raw ? JSON.parse(raw) : { autoMode: false, channelId: 'chants' };
  } catch { return { autoMode: false, channelId: 'chants' }; }
}

export async function setStudioConfig(data) {
  try { await redisCmd('SET', 'studio_config', JSON.stringify(data)); } catch {}
}

// ── YouTube token storage ─────────────────────────────────────────────────────
export async function saveYouTubeToken(channelId, refreshToken) {
  try { await redisCmd('SET', `yt_refresh_token:${channelId}`, refreshToken); } catch {}
}

export async function getYouTubeRefreshToken(channelId) {
  try {
    return await redisCmd('GET', `yt_refresh_token:${channelId}`)
      || process.env.YOUTUBE_REFRESH_TOKEN
      || null;
  } catch { return process.env.YOUTUBE_REFRESH_TOKEN || null; }
}

async function getFreshAccessToken(channelId) {
  const refreshToken = await getYouTubeRefreshToken(channelId);
  if (!refreshToken) throw new Error('No YouTube refresh token — connect YouTube from Auto Studio first');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.YOUTUBE_CLIENT_ID     || '',
      client_secret: process.env.YOUTUBE_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${data.error_description}`);
  return data.access_token;
}

// ── Deity descriptions (canonical visual, same as videoUtils) ─────────────────
const DEITY_DESCRIPTIONS = {
  krishna:     'Lord Krishna glowing sapphire-blue divine skin golden crown with peacock feather plume yellow pitambara silk dhoti golden armlets necklace bamboo flute raised to lips serene divine smile lotus eyes golden celestial aura',
  shiva:       'Lord Shiva ash-smeared pale complexion towering matted jata dreadlocks crescent moon Ganga river flowing from hair blazing divine third eye blue Neelkantha throat rudraksha mala coiled serpent necklace tiger skin four arms holding gleaming trishula trident and damru drum deep meditation snowy Kailash peak',
  hanuman:     'Lord Hanuman powerfully muscular reddish-golden sinduri complexion humble devotional tear-filled eyes golden crown saffron langot dhoti sacred janeu across chest mighty gada mace in hand strong tail raised upward heart open showing Ram naam bowing with deep bhakti',
  ganesh:      'Lord Ganesha elephant head left tusk intact four arms warm golden complexion large round divine belly saffron red silk dhoti golden crown ornaments holding modak sweet ankush hook lotus flower large fan ears gentle divine smile tiny mouse vahana at lotus feet',
  ganesha:     'Lord Ganesha elephant head intact left tusk four arms golden complexion round belly saffron silk dhoti golden crown modak sweet ankush hook lotus flower gentle smile mouse vahana marigold garlands',
  rama:        'Lord Rama divine blue complexion noble Kshatriya prince Ayodhya royal crown tilak forehead yellow silk dhoti sacred janeu thread golden ornaments Kodanda bow quiver of arrows serene compassionate noble expression divine majesty',
  lakshmi:     'Goddess Lakshmi radiant golden complexion seated on large pink lotus red silk saree gold border pearl necklace gold bangles ornaments eight arms holding lotus flowers gold coins flowing from palm gentle divine serene smile abundance prosperity',
  vishnu:      'Lord Vishnu four arms dark blue complexion Sudarshana Chakra Shankha conch lotus Kaumodaki mace Shrivatsa mark Kaustubha gem necklace yellow pitambara silk Kireetam crown resting on Shesha serpent cosmic ocean',
  durga:       'Goddess Durga ten divine arms each holding sacred weapon trishula sword chakra bow arrow shield lotus fierce beautiful expression golden crown red silk saree riding powerful golden lion triumphant divine shakti radiance',
  saraswati:   'Goddess Saraswati pure white complexion pure white silk saree seated on white lotus gracefully playing veena stringed instrument book of Vedas mala beads serene gentle wise expression divine knowledge soft luminous aura',
  brahma:      'Lord Brahma four faces four arms holding Vedas lotus water pot kamandal sacred thread long white beard seated on lotus creator aspect divine',
  surya:       'Lord Surya sun god radiant golden glowing complexion arms holding lotus flowers seated on chariot seven colorful horses crown of solar rays divine golden aura sunrise backdrop celestial brilliance',
  chanakya:    'Acharya Chanakya lean elderly scholar shaved head single shikha tuft simple white dhoti austere piercing sharp intelligent eyes holding palm leaf scroll oil lamp ancient scholarly wisdom',
};

function injectDeityDesc(text) {
  const lower = text.toLowerCase();
  for (const [key, desc] of Object.entries(DEITY_DESCRIPTIONS)) {
    if (lower.includes(key)) {
      const re = new RegExp(`\\b${key}\\b`, 'gi');
      return text.replace(re, desc);
    }
  }
  return text;
}

const DIVINE_SUFFIX = "Indian classical divine fine art Raja Ravi Varma masterpiece style, ultra-detailed 8K resolution, luminous golden divine aura, celestial light rays, intricate silk garments and jewellery, rich jewel-toned colors, sacred spiritual atmosphere, museum-quality artwork, perfect facial anatomy, sharp clear face, no watermark, masterpiece, award-winning";

function buildImagePrompt(scenePrompt, format = 'portrait') {
  const enhanced = injectDeityDesc(scenePrompt);
  const cleaned  = enhanced.replace(/[^\w\s,]/g, ' ').slice(0, 600);
  const aspect   = format === 'portrait'
    ? '9:16 aspect ratio, vertical composition, portrait orientation'
    : '16:9 aspect ratio, horizontal composition';
  return `${cleaned}, ${DIVINE_SUFFIX}, ${aspect}`;
}

// ── Script parser (mirrors splitScenes from videoUtils) ──────────────────────
function splitScenes(script) {
  if (!/^[SsNn]-/m.test(script)) {
    return script.split(/\n\n+/).map(s => s.trim()).filter(s => s.length > 2)
      .map(text => ({ scenePrompt: text, narration: text }));
  }
  const scenes = [];
  let scenePrompt = '', narration = '';
  for (const line of script.split('\n')) {
    const t = line.trim();
    if (/^[Ss]-/i.test(t)) {
      if (scenePrompt) scenes.push({ scenePrompt, narration: narration || scenePrompt });
      scenePrompt = t.replace(/^[Ss]-\s*/i, '').trim();
      narration = '';
    } else if (/^[Nn]-/i.test(t)) {
      const raw = t.replace(/^[Nn]-\s*/i, '').trim();
      const m = raw.match(/^\[[^\]]+\]\s*([\s\S]*)/);
      narration = (m ? m[1] : raw).replace(/^["'""]|["'""]$/g, '').trim();
    }
  }
  if (scenePrompt) scenes.push({ scenePrompt, narration: narration || scenePrompt });
  return scenes.filter(s => s.scenePrompt.length > 0);
}

// ── Fetch image from Pollinations proxy ──────────────────────────────────────
async function fetchImage(prompt, width, height, appUrl) {
  const url = `${appUrl}/api/image?prompt=${encodeURIComponent(prompt)}&width=${width}&height=${height}&seed=${Math.floor(Math.random() * 99999)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(35000) });
      if (!res.ok) throw new Error(`Image ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) throw new Error('Image generation failed');
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// ── Fetch TTS audio ──────────────────────────────────────────────────────────
async function fetchAudio(text, lang, style, appUrl) {
  const url = `${appUrl}/api/tts?text=${encodeURIComponent(text.slice(0, 400))}&lang=${lang}&style=${encodeURIComponent(style)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`TTS ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

// ── Get audio duration via ffmpeg stderr ─────────────────────────────────────
async function getAudioDuration(filePath) {
  try {
    // ffmpeg -i exits with code 1 but puts duration info in stderr
    const r = await execFileAsync(ffmpegBin, ['-i', filePath], { timeout: 8000 }).catch(e => e);
    const out = (r.stderr || r.message || '');
    const m = out.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
    if (m) return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
  } catch {}
  return 3.5;
}

// ── Build FFmpeg filter_complex ──────────────────────────────────────────────
function buildFilterComplex(durations, N, W, H, FPS) {
  const FADE = 0.35;
  const parts = [];

  for (let i = 0; i < N; i++) {
    parts.push(
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,` +
      `crop=${W}:${H},setsar=1,fps=${FPS}[v${i}]`
    );
  }

  if (N === 1) {
    parts.push('[v0]copy[vout]');
  } else {
    let offset = 0;
    let prev = 'v0';
    for (let i = 0; i < N - 1; i++) {
      offset += durations[i] - FADE;
      const out = i === N - 2 ? 'vout' : `x${i}`;
      parts.push(
        `[${prev}][v${i + 1}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}[${out}]`
      );
      prev = out;
    }
  }

  const audioIn = Array.from({ length: N }, (_, i) => `[${N + i}:a]`).join('');
  parts.push(`${audioIn}concat=n=${N}:v=0:a=1[aout]`);

  return parts.join(';');
}

// ── Compose video with FFmpeg ─────────────────────────────────────────────────
export async function composeVideo(scenes, format = 'portrait') {
  // scenes: [{ imageBuffer: Buffer, audioBuffer: Buffer|null }]
  const W   = format === 'portrait' ? 1080 : 1280;
  const H   = format === 'portrait' ? 1920 : 720;
  const FPS = 24;
  const tmp = path.join(tmpdir(), `studio_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  await mkdir(tmp, { recursive: true });

  try {
    const imgPaths = [], audPaths = [];

    for (let i = 0; i < scenes.length; i++) {
      const imgPath = path.join(tmp, `img_${i}.jpg`);
      await writeFile(imgPath, scenes[i].imageBuffer);
      imgPaths.push(imgPath);

      const audPath = path.join(tmp, `aud_${i}.mp3`);
      if (scenes[i].audioBuffer) {
        await writeFile(audPath, scenes[i].audioBuffer);
      } else {
        // Generate 3s of silence as AAC
        await execFileAsync(ffmpegBin, [
          '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
          '-t', '3', '-c:a', 'libmp3lame', '-q:a', '9', audPath,
        ], { timeout: 10000 });
      }
      audPaths.push(audPath);
    }

    const durations = await Promise.all(audPaths.map(getAudioDuration));
    const N = scenes.length;

    const args = [];
    for (let i = 0; i < N; i++) {
      args.push('-loop', '1', '-t', (durations[i] + 0.4).toFixed(2), '-i', imgPaths[i]);
    }
    for (const p of audPaths) args.push('-i', p);

    args.push('-filter_complex', buildFilterComplex(durations, N, W, H, FPS));
    args.push('-map', '[vout]', '-map', '[aout]');
    args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p');
    args.push('-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest');

    const outPath = path.join(tmp, 'output.mp4');
    args.push(outPath);

    await execFileAsync(ffmpegBin, args, {
      timeout: 180000,
      maxBuffer: 100 * 1024 * 1024,
    });

    return await readFile(outPath);
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// ── YouTube upload ────────────────────────────────────────────────────────────
export async function uploadToYouTube(videoBuffer, meta) {
  const { youtubeTitle, youtubeDescription, youtubeTags, channelId, deity, angle, topic, genre } = meta;
  const accessToken = await getFreshAccessToken(channelId);

  const metadata = {
    snippet: {
      title: (youtubeTitle || 'Auto-generated Short').slice(0, 100),
      description: youtubeDescription || '',
      tags: (youtubeTags || []).map(t => t.replace(/^#/, '')).slice(0, 15),
      categoryId: '27',
      defaultLanguage: 'hi',
    },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
  };

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(videoBuffer.length),
      },
      body: JSON.stringify(metadata),
      signal: AbortSignal.timeout(30000),
    }
  );
  if (!initRes.ok) throw new Error(`YouTube init ${initRes.status}: ${await initRes.text().catch(() => '')}`);

  const uploadUrl = initRes.headers.get('Location');
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(videoBuffer.length) },
    body: videoBuffer,
    signal: AbortSignal.timeout(180000),
  });
  if (!uploadRes.ok) throw new Error(`YouTube upload ${uploadRes.status}`);

  const result = await uploadRes.json();
  const videoId  = result.id;
  const videoUrl = `https://www.youtube.com/shorts/${videoId}`;

  // Persist to Redis history
  try {
    const entry = JSON.stringify({ videoId, videoUrl, title: youtubeTitle, channelId, uploadedAt: new Date().toISOString(), deity, angle, topic, genre });
    await redisCmd('LPUSH', `yt_history:${channelId}`, entry);
    await redisCmd('LTRIM', `yt_history:${channelId}`, 0, 49);
  } catch {}

  return { videoId, videoUrl };
}

// ── Full pipeline (called by cron) ───────────────────────────────────────────
export async function runPipeline({ jobId, deity, angle, topic, genre, channelId, youtubeTitle, youtubeDescription, youtubeTags, script, appUrl, language = 'hi', format = 'portrait' }) {
  const W = format === 'portrait' ? 1080 : 1280;
  const H = format === 'portrait' ? 1920 : 720;

  const scenes = splitScenes(script);
  if (!scenes.length) throw new Error('Script produced no scenes');

  // Phase: images
  await updateJob(jobId, { status: 'images', progress: `0/${scenes.length} images` });

  const imageBuffers = await Promise.all(
    scenes.map(async (scene, i) => {
      try {
        const prompt = buildImagePrompt(scene.scenePrompt, format);
        const buf = await fetchImage(prompt, W, H, appUrl);
        await updateJob(jobId, { progress: `${i + 1}/${scenes.length} images` });
        return buf;
      } catch (e) {
        console.warn(`Image ${i} failed:`, e.message);
        return null;
      }
    })
  );

  // Phase: audio
  await updateJob(jobId, { status: 'audio', progress: `0/${scenes.length} audio clips` });
  const ttsStyle = ['chants', 'wisdom', 'chanakya'].includes(genre) ? 'spiritual' : '';

  const audioBuffers = [];
  for (let i = 0; i < scenes.length; i++) {
    const buf = await fetchAudio(scenes[i].narration || scenes[i].scenePrompt, language, ttsStyle, appUrl);
    audioBuffers.push(buf);
    await updateJob(jobId, { progress: `${i + 1}/${scenes.length} audio clips` });
  }

  // Build scene objects — skip scenes with no image
  const validScenes = scenes
    .map((_, i) => ({ imageBuffer: imageBuffers[i], audioBuffer: audioBuffers[i] }))
    .filter(s => s.imageBuffer);

  if (!validScenes.length) throw new Error('No images could be generated');

  // Phase: render
  await updateJob(jobId, { status: 'render', progress: `Composing ${validScenes.length} scenes with FFmpeg…` });
  const videoBuffer = await composeVideo(validScenes, format);

  // Phase: upload
  await updateJob(jobId, { status: 'upload', progress: 'Uploading to YouTube…' });
  const ytResult = await uploadToYouTube(videoBuffer, {
    youtubeTitle, youtubeDescription, youtubeTags, channelId, deity, angle, topic, genre,
  });

  return ytResult;
}
