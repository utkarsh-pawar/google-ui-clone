'use client';
import { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  STYLES, FORMATS, splitScenes, sceneDurationFromText, makeImagePrompt,
  pollinationsUrl, loadImage, loadVideoClip, fetchSceneAudio, renderVideo,
} from '@/lib/videoUtils';

const GenerationContext = createContext(null);
const HISTORY_KEY = 'video-generation-history';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveHistory(history) {
  try {
    const meta = history.map(({ videoUrl, scenes, ...rest }) => ({
      ...rest, sceneCount: scenes?.length || rest.sceneCount || 0,
    }));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(meta.slice(0, 20)));
  } catch {}
}

// Resolves as soon as the document tab is visible (or immediately if already visible)
function waitForVisible() {
  if (typeof document === 'undefined' || !document.hidden) return Promise.resolve();
  return new Promise(resolve => {
    const handler = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', handler); resolve(); } };
    document.addEventListener('visibilitychange', handler);
  });
}

async function fetchImage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try { return await loadImage(url); }
    catch { if (i === retries - 1) return null; }
  }
  return null;
}

export const VIDEO_RATE_LIMITED = Symbol('rate_limited');

async function fetchVideoUrl(scenePrompt, format) {
  try {
    const orientation = format.id === 'portrait' ? 'portrait' : 'landscape';
    const res = await fetch(`/api/video-source?prompt=${encodeURIComponent(scenePrompt)}&orientation=${orientation}`);
    if (res.status === 429) return VIDEO_RATE_LIMITED;
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch {
    return null;
  }
}

// Upload video to YouTube using stored token — returns { videoId, videoUrl } or null
async function autoUploadToYouTube(blob, { youtubeTitle, youtubeDescription, youtubeTags, channelId }) {
  try {
    const { getFreshToken, saveUploadHistoryEntry } = await import('@/lib/youtubeUtils');
    const accessToken = await getFreshToken(channelId);

    const metadata = {
      snippet: {
        title: (youtubeTitle || 'Auto-generated Short').slice(0, 100),
        description: youtubeDescription || '',
        tags: (youtubeTags || []).map(t => t.replace(/^#/, '')).slice(0, 15),
        categoryId: '27',
        defaultLanguage: 'en',
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
          'X-Upload-Content-Type': blob.type || 'video/webm',
          'X-Upload-Content-Length': blob.size,
        },
        body: JSON.stringify(metadata),
      }
    );
    if (!initRes.ok) throw new Error(`YouTube init ${initRes.status}`);

    const uploadUrl = initRes.headers.get('Location');
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || 'video/webm', 'Content-Length': blob.size },
      body: blob,
    });
    if (!uploadRes.ok) throw new Error(`YouTube upload ${uploadRes.status}`);

    const result = await uploadRes.json();
    const videoId = result.id;
    const ytUrl = `https://www.youtube.com/shorts/${videoId}`;
    if (saveUploadHistoryEntry) {
      saveUploadHistoryEntry({ videoId, videoUrl: ytUrl, title: youtubeTitle, channelId, uploadedAt: new Date().toISOString() });
    }
    return { videoId, videoUrl: ytUrl };
  } catch (err) {
    console.warn('Auto-upload failed:', err.message);
    return null;
  }
}

export function GenerationProvider({ children }) {
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState([]);
  const [toasts, setToasts] = useState([]);
  const abortRef = useRef(false);

  const addToast = useCallback((msg) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const startGeneration = useCallback(async ({
    script, style, format, language = 'en', speedMultiplier, narration, voice,
    titleText, youtubeTitle, youtubeDescription, youtubeTags, channelId,
    characters = [],
    autoUpload = false,     // ← when true: auto-upload to YouTube after render
    onComplete = null,      // ← optional callback(result) after everything done
  }) => {
    abortRef.current = false;
    const rawScenes = splitScenes(script);
    if (!rawScenes.length) return;

    const characterDefs = {};
    for (const c of characters) {
      if (c.name?.trim()) characterDefs[c.name.toLowerCase().trim()] = c;
    }

    const id = Date.now().toString();
    const title = (rawScenes[0].narration || rawScenes[0].scenePrompt || '').slice(0, 60);
    const selectedStyle = STYLES.find(s => s.id === style) || STYLES[0];
    const selectedFormat = FORMATS.find(f => f.id === format) || FORMATS[0];
    const sceneDurations = rawScenes.map(s =>
      sceneDurationFromText(s.narration || s.scenePrompt, speedMultiplier)
    );

    const scenes = rawScenes.map(s => ({ ...s, image: null, error: false, errorMsg: null }));

    setActive({
      id, title, style, format, language, speedMultiplier, narration, voice, titleText, rawScenes,
      channelId: channelId || 'general',
      scenes: [...scenes],
      progress: { step: 'Generating images…', current: 0, total: rawScenes.length, background: true },
      status: 'generating',
      videoUrl: null, error: null,
      createdAt: new Date().toISOString(),
    });

    // ── Phase 1: Images / video clips ────────────────────────────────────────
    let imgDone = 0;
    let videoRateLimited = false;
    const BATCH = 4;

    for (let i = 0; i < rawScenes.length; i += BATCH) {
      if (abortRef.current) break;
      const batchIndices = Array.from({ length: Math.min(BATCH, rawScenes.length - i) }, (_, j) => i + j);

      await Promise.allSettled(batchIndices.map(async idx => {
        const scene = rawScenes[idx];

        let videoUrl = null;
        if (!videoRateLimited) {
          const result = await fetchVideoUrl(scene.scenePrompt, selectedFormat);
          if (result === VIDEO_RATE_LIMITED) {
            videoRateLimited = true;
          } else {
            videoUrl = result;
          }
        }

        let img = null;
        if (!videoUrl) {
          const imgPrompt = makeImagePrompt(scene.scenePrompt, selectedStyle.suffix, selectedFormat, idx === 0, scene.character || '', characterDefs);
          img = await fetchImage(pollinationsUrl(imgPrompt, selectedFormat.width, selectedFormat.height, idx), 3);
        }

        imgDone++;
        scenes[idx] = { ...rawScenes[idx], image: img, videoUrl: videoUrl || null, videoEl: null, error: false, errorMsg: null };
        setActive(a => ({
          ...a,
          scenes: [...scenes],
          progress: {
            step: videoUrl ? 'Fetching video clips…' : 'Generating images…',
            current: imgDone, total: rawScenes.length, background: true,
          },
        }));
      }));
    }

    if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }

    // ── Phase 2: Audio ────────────────────────────────────────────────────────
    let audioBuffers = [];
    if (narration) {
      setActive(a => ({
        ...a,
        progress: { step: 'Generating narration…', current: 0, total: rawScenes.length, background: true },
      }));

      const audioResults = await Promise.allSettled(
        rawScenes.map(scene => fetchSceneAudio(scene.narration || scene.scenePrompt, voice || 'Brian', language, scene.character || ''))
      );
      audioBuffers = audioResults.map(r => r.status === 'fulfilled' ? r.value : null);

      setActive(a => ({
        ...a,
        progress: { step: 'Generating narration…', current: rawScenes.length, total: rawScenes.length, background: true },
      }));
    }

    if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }

    // ── Phase 3: Render ───────────────────────────────────────────────────────
    setActive(a => ({ ...a, status: 'waiting', progress: { step: 'Open this tab to start rendering…', current: 0, total: scenes.length, background: false } }));
    await waitForVisible();

    if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }

    const hasVideoClips = scenes.some(s => s.videoUrl);
    if (hasVideoClips) {
      setActive(a => ({ ...a, status: 'recording', progress: { step: 'Loading video clips…', current: 0, total: scenes.length } }));
      await Promise.allSettled(scenes.map(async (scene, idx) => {
        if (!scene.videoUrl) return;
        try {
          scenes[idx] = { ...scene, videoEl: await loadVideoClip(scene.videoUrl) };
        } catch {}
      }));
    }

    setActive(a => ({ ...a, status: 'recording', progress: { step: 'Recording video…', current: 0, total: scenes.length } }));

    try {
      const { url: videoUrl, blob: videoBlob } = await renderVideo(
        scenes, sceneDurations,
        (current, total) => setActive(a => ({ ...a, progress: { step: 'Recording video…', current, total } })),
        audioBuffers, selectedFormat, titleText || '',
        selectedStyle.subtitleStyle || 'bar',
        style,
      );

      // ── Phase 4: Auto-upload ──────────────────────────────────────────────
      let ytResult = null;
      if (autoUpload && videoBlob) {
        setActive(a => ({ ...a, status: 'uploading', progress: { step: 'Uploading to YouTube…', current: scenes.length, total: scenes.length } }));
        ytResult = await autoUploadToYouTube(videoBlob, { youtubeTitle, youtubeDescription, youtubeTags, channelId });
        addToast(ytResult
          ? `✅ Uploaded: ${youtubeTitle || title}`
          : '⚠️ Upload failed — video saved locally'
        );
      }

      const done = {
        id, title, style, format, language, speedMultiplier, narration, voice, titleText, rawScenes,
        channelId: channelId || 'general',
        scenes, status: 'done', videoUrl, youtubeTitle, youtubeDescription, youtubeTags,
        ytVideoId: ytResult?.videoId || null,
        ytVideoUrl: ytResult?.videoUrl || null,
        progress: { step: ytResult ? `Uploaded ✅` : 'Done', current: scenes.length, total: scenes.length },
        createdAt: new Date().toISOString(),
      };
      setActive(done);
      setHistory(h => { const updated = [done, ...h]; saveHistory(updated); return updated; });
      onComplete?.(done);
    } catch (err) {
      setActive(a => ({ ...a, status: 'error', error: err.message }));
    }
  }, [addToast]);

  const cancelGeneration = useCallback(() => { abortRef.current = true; }, []);

  const historyLoaded = useRef(false);
  if (typeof window !== 'undefined' && !historyLoaded.current) {
    historyLoaded.current = true;
    const saved = loadHistory();
    if (saved.length && history.length === 0) setHistory(saved);
  }

  return (
    <GenerationContext.Provider value={{ active, history, toasts, startGeneration, cancelGeneration, dismissToast }}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration() {
  return useContext(GenerationContext);
}
