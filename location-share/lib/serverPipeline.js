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
  krishna:    'Lord Krishna radiant sapphire-blue divine skin glistening, tall golden Kireedam crown with peacock feather plume, yellow pitambara silk dhoti with gold border, golden Keyura armlets and cascading pearl necklaces, bamboo bansuri flute raised gently to lips, serene divine half-smile, half-closed lotus eyes radiating eternal love and peace, soft golden aura surrounding entire form',
  shri:       'Lord Krishna radiant sapphire-blue divine skin, golden peacock-feather crown, yellow pitambara silk, bamboo flute, serene divine smile, lotus eyes, golden celestial aura',
  radha:      'Goddess Radha beautiful golden complexion, elegant pink and gold silk saree, flower garland, braid adorned with jasmine, hands clasped in devotion, tear of love on cheek, soft divine glow, expression of pure bhakti and longing',
  shiva:      'Lord Shiva sacred ash-smeared ice-white complexion, towering Jatamukuta matted dreadlocks adorned with crescent moon Chandra and flowing Ganga river, blazing divine third eye on forehead, deep blue Neelkantha throat, multi-strand rudraksha mala, coiled Vasuki serpent necklace, tiger-skin seat, four divine arms holding gleaming silver trishula trident and small damru drum, seated in absolute stillness on Himalayan Kailash snow peak',
  shankar:    'Lord Shiva ash-smeared pale complexion, matted jata with crescent moon, Ganga river flowing from hair, blazing divine third eye, blue Neelkantha throat, rudraksha mala, trishula trident, deep meditation, snowy Kailash peak',
  hanuman:    'Lord Hanuman powerfully muscular reddish-golden sinduri complexion, humble tear-filled devotional eyes, tall golden Kireedam crown, saffron langot dhoti, sacred janeu thread across broad chest, mighty golden gada mace raised in right hand, strong tail curled upward, heart open with Ram naam written inside, expression of fierce devotion and fearlessness',
  bajrangbali:'Lord Hanuman powerfully muscular reddish-golden complexion, golden crown, saffron dhoti, gada mace raised, tail raised, heart open showing Ram naam, devotional fierce expression, divine strength radiating',
  ganesh:     'Lord Ganesha large elephant head with intact left tusk, four arms, warm golden complexion, large round divine belly, saffron-red silk dhoti with golden border, tall golden Kireedam crown with gemstones, hands holding modak sweet ball, ankush hook, lotus flower, and abhaya blessing gesture, large fan ears spread wide, gentle divine smile of wisdom, small mouse Mushaka vahana at lotus feet',
  ganesha:    'Lord Ganesha elephant head intact left tusk, four arms, golden complexion, round belly, saffron silk dhoti, golden crown, modak sweet, ankush hook, lotus flower, gentle smile, mouse vahana, marigold garlands',
  rama:       'Lord Rama noble blue-complexioned Kshatriya prince, tall royal crown with golden Tilak on forehead, yellow silk dhoti, sacred janeu thread, golden Keyura ornaments, Kodanda bow in left hand and quiver of golden arrows on back, serene noble expression of compassion and righteousness, divine golden aura of dharma',
  ram:        'Lord Rama noble blue complexion, royal crown, tilak, yellow silk dhoti, janeu, golden ornaments, Kodanda bow, quiver of arrows, serene compassionate noble expression, divine majesty',
  sita:       'Goddess Sita divine golden complexion, graceful red silk saree with gold border, lotus flower in hand, serene expression of pure devotion and strength, divine gentle aura, jasmine flowers in braid',
  durga:      'Goddess Durga ten divine arms each holding a sacred weapon — trishula, sword, Sudarshana chakra, bow, arrow, shield, lotus, and more — fierce yet supremely beautiful expression, tall golden crown, crimson red silk saree with gold, riding a powerful golden lion in full stride, divine Shakti energy radiating',
  lakshmi:    'Goddess Lakshmi radiant gold-toned complexion, seated gracefully on a large pink lotus flower, crimson red silk saree with gold weave, cascading pearl necklaces and gold bangles, eight arms — some holding pink lotus flowers, golden coins flowing abundantly from one palm, expression of gentle serene divine grace, pink lotus flowers floating all around',
  saraswati:  'Goddess Saraswati luminous fair complexion, pure white silk saree with delicate gold border, seated peacefully on white lotus, hands gracefully holding veena stringed instrument, other hands holding Vedas book and white lotus, pearl mala beads, serene gentle wise expression of divine knowledge, soft luminous white aura, white swan beside her',
  vishnu:     'Lord Vishnu four arms, dark blue complexion, Sudarshana Chakra spinning in one hand, Panchajanya Shankha conch in second, pink lotus in third, Kaumodaki mace in fourth, Shrivatsa mark and Kaustubha gem on chest, yellow pitambara silk, Kireetam golden crown, reclining on thousand-headed Shesha serpent on cosmic milk ocean, divine expression of supreme peace',
  brahma:     'Lord Brahma four divine faces looking in four directions, four arms holding Vedas, lotus flower, water pot kamandal, and sacred rosary, long white beard and matted hair, white silk dhoti, seated on a large lotus flower, creator aspect, divine golden aura',
  indra:      'Lord Indra king of heavens, fair complexion, tall golden crown with thousand eyes pattern, royal blue and gold silk robes, Vajra thunderbolt weapon in hand, seated on Airavata white celestial elephant, divine royal authority expression',
  arjun:      'Arjuna noble warrior golden complexion, Kshatriya warrior armor and jewels, Gandiva bow raised, quiver of arrows, determined fierce warrior expression, battlefield of Kurukshetra behind him, divine golden light',
  arjuna:     'Arjuna noble Kshatriya warrior, golden complexion, battle armor and ornaments, Gandiva bow in hand, quiver of divine arrows, determined expression, Kurukshetra battlefield, divine golden aura, chariot behind',
  surya:      'Lord Surya sun god radiant golden-amber glowing complexion, arms holding twin pink lotus flowers, seated on golden chariot pulled by seven colorful celestial horses, tall crown of golden solar rays, divine golden aura blazing, brilliant sunrise sky behind, celestial light streaming',
  chanakya:   'Acharya Chanakya lean elderly sage, shaved head with single shikha tuft, simple white dhoti, austere bearing, piercing sharp intelligent deep-set eyes, holding a dried palm-leaf manuscript scroll, oil lamp burning beside him, seated on simple mat in ancient stone chamber, expression of absolute wisdom and determination',
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

const DIVINE_SUFFIX = "Indian classical divine fine art, Raja Ravi Varma and Oleograph masterpiece style, ultra-detailed 8K resolution, luminous golden divine aura with soft radiating light rays, intricate hand-woven silk garments with gold zari threadwork, elaborate gemstone jewellery, rich jewel-toned colors — deep crimson, royal sapphire blue, marigold gold, sacred saffron, sacred spiritual atmosphere charged with devotion, museum-quality oil painting texture, perfect facial anatomy, serene sharp face, deity eyes clear and divine, no text no watermark, cinematic depth of field, masterpiece award-winning sacred art";

function buildImagePrompt(scenePrompt, format = 'portrait') {
  const enhanced = injectDeityDesc(scenePrompt);
  const cleaned  = enhanced.replace(/[^\w\s,]/g, ' ').slice(0, 900);
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

  // Phase: audio (parallel in batches of 4 to stay within TTS rate limits)
  await updateJob(jobId, { status: 'audio', progress: `0/${scenes.length} audio clips` });
  const ttsStyle = ['chants', 'wisdom', 'chanakya'].includes(genre) ? 'spiritual' : '';

  const audioBuffers = new Array(scenes.length).fill(null);
  const AUDIO_BATCH = 4;
  for (let b = 0; b < scenes.length; b += AUDIO_BATCH) {
    const chunk = scenes.slice(b, b + AUDIO_BATCH);
    const results = await Promise.all(
      chunk.map(scene => fetchAudio(scene.narration || scene.scenePrompt, language, ttsStyle, appUrl))
    );
    results.forEach((buf, j) => { audioBuffers[b + j] = buf; });
    await updateJob(jobId, { progress: `${Math.min(b + AUDIO_BATCH, scenes.length)}/${scenes.length} audio clips` });
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
