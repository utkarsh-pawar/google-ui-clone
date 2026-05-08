'use client';
import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import {
  STYLES, FORMATS, splitScenes, sceneDurationFromText, makeImagePrompt,
  pollinationsUrl, loadImage, loadVideoClip, fetchSceneAudio, renderVideo,
} from '@/lib/videoUtils';
import { getImageQueue } from '@/lib/imageQueue';

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

function waitForVisible() {
  if (typeof document === 'undefined' || !document.hidden) return Promise.resolve();
  return new Promise(resolve => {
    const handler = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', handler); resolve(); } };
    document.addEventListener('visibilitychange', handler);
  });
}

// Fetches a single image, throws on failure so the queue can handle retry/backoff
async function fetchImageViaQueue(url) {
  const res = await fetch(url);
  if (res.status === 429) { const e = new Error('429'); e.status = 429; throw e; }
  if (!res.ok) throw new Error(`Image ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) throw new Error('AI image failed');
  return loadImage(url);
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
    saveUploadHistoryEntry?.({ videoId, videoUrl: ytUrl, title: youtubeTitle, channelId, uploadedAt: new Date().toISOString() });
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
  // Approval promise resolver — set when pipeline is paused waiting for user
  const approvalRef = useRef(null);

  const addToast = useCallback((msg) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  // Called by the UI "Next →" button to advance past a review phase
  const approvePhase = useCallback(() => {
    if (approvalRef.current) {
      approvalRef.current();
      approvalRef.current = null;
    }
  }, []);

  // Retry a single scene image without restarting the whole pipeline
  const retryScene = useCallback(async (idx) => {
    setActive(a => {
      if (!a) return a;
      const scenes = [...a.scenes];
      scenes[idx] = { ...scenes[idx], image: null, error: false, errorMsg: null, retrying: true, queueStatus: 'queued' };
      return { ...a, scenes };
    });

    const snap = await new Promise(resolve => setActive(a => { resolve(a); return a; }));
    if (!snap) return;

    const scene = snap.scenes[idx];
    const selectedStyle = STYLES.find(s => s.id === snap.style) || STYLES[0];
    const selectedFormat = FORMATS.find(f => f.id === snap.format) || FORMATS[0];
    const characterDefs = snap.characterDefs || {};
    const imgPrompt = makeImagePrompt(
      scene.scenePrompt, selectedStyle.suffix, selectedFormat,
      idx === 0, scene.character || '', characterDefs
    );
    const url = pollinationsUrl(imgPrompt, selectedFormat.width, selectedFormat.height, Date.now());

    const queue = getImageQueue();
    try {
      const img = await queue.add(
        () => fetchImageViaQueue(url),
        (status, extra) => setActive(b => {
          if (!b) return b;
          const next = [...b.scenes];
          next[idx] = { ...next[idx], queueStatus: status, ...(extra || {}) };
          return { ...b, scenes: next };
        }),
      );
      setActive(b => {
        if (!b) return b;
        const next = [...b.scenes];
        next[idx] = { ...next[idx], image: img, error: !img, errorMsg: img ? null : 'AI image failed — click retry to try again', retrying: false, queueStatus: null };
        return { ...b, scenes: next };
      });
    } catch {
      setActive(b => {
        if (!b) return b;
        const next = [...b.scenes];
        next[idx] = { ...next[idx], image: null, error: true, errorMsg: 'AI image failed — click retry to try again', retrying: false, queueStatus: null };
        return { ...b, scenes: next };
      });
    }
  }, []);

  const startGeneration = useCallback(async ({
    script, style, format, language = 'en', speedMultiplier, narration, voice,
    titleText, youtubeTitle, youtubeDescription, youtubeTags, channelId,
    characters = [],
    autoUpload = false,
    onComplete = null,
  }) => {
    abortRef.current = false;
    approvalRef.current = null;

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
      characterDefs,           // stored for retry use
      scenes: [...scenes],
      progress: { step: 'Generating images…', current: 0, total: rawScenes.length },
      status: 'generating',
      videoUrl: null, error: null,
      createdAt: new Date().toISOString(),
    });

    // ── Phase 1: Images ───────────────────────────────────────────────────────
    let imgDone = 0;
    let videoRateLimited = false;
    const queue = getImageQueue();

    await Promise.allSettled(rawScenes.map(async (scene, idx) => {
      if (abortRef.current) return;

      // Mark queued immediately so UI shows position
      scenes[idx] = { ...rawScenes[idx], image: null, videoUrl: null, videoEl: null, error: false, errorMsg: null, queueStatus: 'queued' };
      setActive(a => ({ ...a, scenes: [...scenes] }));

      let videoUrl = null;
      if (!videoRateLimited) {
        const result = await fetchVideoUrl(scene.scenePrompt, selectedFormat);
        if (result === VIDEO_RATE_LIMITED) videoRateLimited = true;
        else videoUrl = result;
      }

      let img = null;
      if (!videoUrl) {
        const imgPrompt = makeImagePrompt(scene.scenePrompt, selectedStyle.suffix, selectedFormat, idx === 0, scene.character || '', characterDefs);
        const url = pollinationsUrl(imgPrompt, selectedFormat.width, selectedFormat.height, idx);
        try {
          img = await queue.add(
            () => fetchImageViaQueue(url),
            (status, extra) => setActive(a => {
              const next = [...a.scenes];
              next[idx] = { ...next[idx], queueStatus: status, ...(extra || {}) };
              return { ...a, scenes: next };
            }),
          );
        } catch {
          img = null;
        }
      }

      imgDone++;
      scenes[idx] = {
        ...rawScenes[idx], image: img, videoUrl: videoUrl || null, videoEl: null,
        error: !img && !videoUrl,
        errorMsg: !img && !videoUrl ? 'AI image failed — click ↺ Retry' : null,
        queueStatus: null,
      };
      setActive(a => ({
        ...a, scenes: [...scenes],
        progress: { step: 'Generating images…', current: imgDone, total: rawScenes.length },
      }));
    }));

    if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }

    // ── Pause 1: Review images ────────────────────────────────────────────────
    setActive(a => ({
      ...a, status: 'review-images',
      progress: { step: 'Review images — retry any you don\'t like, then click Next', current: imgDone, total: rawScenes.length },
    }));
    await new Promise(resolve => { approvalRef.current = resolve; });
    if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }

    // ── Phase 2: Audio ────────────────────────────────────────────────────────
    let audioBuffers = [];
    if (narration) {
      setActive(a => ({
        ...a, status: 'narration',
        progress: { step: 'Generating narration…', current: 0, total: rawScenes.length },
      }));

      const audioResults = await Promise.allSettled(
        rawScenes.map(scene => fetchSceneAudio(scene.narration || scene.scenePrompt, voice || 'Brian', language, scene.character || ''))
      );
      audioBuffers = audioResults.map(r => r.status === 'fulfilled' ? r.value : null);

      setActive(a => ({
        ...a,
        progress: { step: 'Narration ready', current: rawScenes.length, total: rawScenes.length },
      }));
    }

    if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }

    // ── Pause 2: Review audio / confirm render ────────────────────────────────
    setActive(a => ({
      ...a, status: 'review-audio',
      progress: { step: narration ? 'Narration ready — click Next to render' : 'Click Next to render video', current: rawScenes.length, total: rawScenes.length },
      audioBuffers, // store for render phase
    }));
    await new Promise(resolve => { approvalRef.current = resolve; });
    if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }

    // ── Phase 3: Render ───────────────────────────────────────────────────────
    setActive(a => ({ ...a, status: 'waiting', progress: { step: 'Open this tab to start rendering…', current: 0, total: scenes.length } }));
    await waitForVisible();
    if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }

    // Load video elements
    const hasVideoClips = scenes.some(s => s.videoUrl);
    if (hasVideoClips) {
      setActive(a => ({ ...a, status: 'recording', progress: { step: 'Loading video clips…', current: 0, total: scenes.length } }));
      await Promise.allSettled(scenes.map(async (scene, idx) => {
        if (!scene.videoUrl) return;
        try { scenes[idx] = { ...scene, videoEl: await loadVideoClip(scene.videoUrl) }; } catch {}
      }));
    }

    setActive(a => ({ ...a, status: 'recording', progress: { step: 'Recording video…', current: 0, total: scenes.length } }));

    try {
      // Use audioBuffers stored in active state (set during Phase 2)
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
        addToast(ytResult ? `✅ Uploaded: ${youtubeTitle || title}` : '⚠️ Upload failed — video saved locally');
      }

      const done = {
        id, title, style, format, language, speedMultiplier, narration, voice, titleText, rawScenes,
        channelId: channelId || 'general', characterDefs,
        scenes, status: 'done', videoUrl, youtubeTitle, youtubeDescription, youtubeTags,
        ytVideoId: ytResult?.videoId || null,
        ytVideoUrl: ytResult?.videoUrl || null,
        progress: { step: ytResult ? 'Uploaded ✅' : 'Done', current: scenes.length, total: scenes.length },
        createdAt: new Date().toISOString(),
      };
      setActive(done);
      setHistory(h => { const updated = [done, ...h]; saveHistory(updated); return updated; });
      onComplete?.(done);
    } catch (err) {
      setActive(a => ({ ...a, status: 'error', error: err.message }));
    }
  }, [addToast]);

  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
    // Also resolve any pending approval so the async function can exit
    if (approvalRef.current) { approvalRef.current(); approvalRef.current = null; }
  }, []);

  const historyLoaded = useRef(false);
  if (typeof window !== 'undefined' && !historyLoaded.current) {
    historyLoaded.current = true;
    const saved = loadHistory();
    if (saved.length && history.length === 0) setHistory(saved);
  }

  return (
    <GenerationContext.Provider value={{ active, history, toasts, startGeneration, cancelGeneration, approvePhase, retryScene, dismissToast }}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration() {
  return useContext(GenerationContext);
}
