'use client';
import { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  STYLES, FORMATS, splitScenes, sceneDurationFromText, makeImagePrompt, pollinationsUrl,
  loadImage, processInBatches, fetchSceneAudio, renderVideo, sleep
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
      ...rest,
      sceneCount: scenes?.length || rest.sceneCount || 0,
    }));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(meta.slice(0, 20)));
  } catch {}
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

  const startGeneration = useCallback(async ({ script, style, format, speedMultiplier, narration, voice, titleText, youtubeTitle, youtubeDescription, youtubeTags }) => {
    abortRef.current = false;
    const rawScenes = splitScenes(script);
    if (!rawScenes.length) return;

    const id = Date.now().toString();
    const title = (rawScenes[0].narration || rawScenes[0].scenePrompt || '').slice(0, 60);
    const selectedStyle = STYLES.find(s => s.id === style) || STYLES[0];
    const selectedFormat = FORMATS.find(f => f.id === format) || FORMATS[0];
    const sceneDurations = rawScenes.map(s => sceneDurationFromText(s.narration || s.scenePrompt, speedMultiplier));

    const initial = {
      id, title, style, format, speedMultiplier, narration, voice, titleText, rawScenes,
      scenes: rawScenes.map(s => ({ ...s, image: null, error: false, errorMsg: null })),
      progress: { step: 'Generating images…', current: 0, total: rawScenes.length },
      status: 'generating',
      videoUrl: null,
      error: null,
      createdAt: new Date().toISOString(),
    };

    setActive(initial);

    // Phase 1: generate images — batches of 2 concurrent, 3 retries each
    const scenes = [...initial.scenes];
    let doneCount = 0;

    await processInBatches(rawScenes, async (scene, idx) => {
      const prompt = makeImagePrompt(scene.scenePrompt, selectedStyle.suffix, selectedFormat);
      return loadImage(pollinationsUrl(prompt, selectedFormat.width, selectedFormat.height, idx));
    }, {
      batchSize: 2,
      retries: 3,
      retryDelay: 3000,
      batchDelay: 800,
      abortRef,
      onItemDone: (idx, img, error) => {
        doneCount++;
        scenes[idx] = { ...rawScenes[idx], image: img, error: !!error, errorMsg: error };
        if (error) addToast(`Scene ${idx + 1}: ${error}`);
        setActive(a => ({
          ...a,
          scenes: [...scenes],
          progress: { step: 'Generating images…', current: doneCount, total: rawScenes.length },
        }));
      },
    });

    if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }

    // Phase 2 (optional): fetch TTS narration
    let audioBuffers = [];
    if (narration) {
      setActive(a => ({ ...a, status: 'generating', progress: { step: 'Generating narration…', current: 0, total: rawScenes.length } }));
      for (let i = 0; i < rawScenes.length; i++) {
        if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }
        setActive(a => ({ ...a, progress: { step: 'Generating narration…', current: i + 1, total: rawScenes.length } }));
        const buf = await fetchSceneAudio(rawScenes[i].narration || rawScenes[i].scenePrompt, voice || 'Brian');
        audioBuffers.push(buf);
      }
    }

    if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }

    // Phase 3: record video
    setActive(a => ({ ...a, status: 'recording', progress: { step: 'Recording video…', current: 0, total: scenes.length } }));

    try {
      const videoUrl = await renderVideo(scenes, sceneDurations, (current, total) => {
        setActive(a => ({ ...a, progress: { step: 'Recording video…', current, total } }));
      }, audioBuffers, selectedFormat, titleText || '');

      const done = { ...initial, scenes, status: 'done', videoUrl, youtubeTitle, youtubeDescription, youtubeTags, progress: { step: 'Done', current: scenes.length, total: scenes.length } };
      setActive(done);

      setHistory(h => {
        const updated = [done, ...h];
        saveHistory(updated);
        return updated;
      });
    } catch (err) {
      setActive(a => ({ ...a, status: 'error', error: err.message }));
    }
  }, [addToast]);

  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
  }, []);

  // Load history on first render (client only)
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
