'use client';
import { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  STYLES, splitScenes, sceneDurationFromText, makeImagePrompt, pollinationsUrl,
  loadImageWithRetry, fetchSceneAudio, renderVideo, sleep
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

  const startGeneration = useCallback(async ({ script, style, speedMultiplier, narration, voice }) => {
    abortRef.current = false;
    const rawScenes = splitScenes(script);
    if (!rawScenes.length) return;

    const id = Date.now().toString();
    const title = rawScenes[0].slice(0, 60);
    const selectedStyle = STYLES.find(s => s.id === style) || STYLES[0];
    const sceneDurations = rawScenes.map(t => sceneDurationFromText(t, speedMultiplier));

    const initial = {
      id, title, style, speedMultiplier, narration, voice, rawScenes,
      scenes: rawScenes.map(text => ({ text, image: null, error: false, errorMsg: null })),
      progress: { step: 'Generating images…', current: 0, total: rawScenes.length },
      status: 'generating',
      videoUrl: null,
      error: null,
      createdAt: new Date().toISOString(),
    };

    setActive(initial);

    // Phase 1: generate images sequentially
    const scenes = [...initial.scenes];
    for (let i = 0; i < rawScenes.length; i++) {
      if (abortRef.current) {
        setActive(a => ({ ...a, status: 'cancelled' }));
        return;
      }
      setActive(a => ({ ...a, progress: { step: 'Generating images…', current: i + 1, total: rawScenes.length } }));

      const prompt = makeImagePrompt(rawScenes[i], selectedStyle.suffix);
      const { img, error } = await loadImageWithRetry(pollinationsUrl(prompt));
      scenes[i] = { text: rawScenes[i], image: img, error: !!error, errorMsg: error };
      setActive(a => ({ ...a, scenes: [...scenes] }));
      if (error) addToast(`Scene ${i + 1}: ${error}`);
      if (i < rawScenes.length - 1) await sleep(100);
    }

    if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }

    // Phase 2 (optional): fetch TTS narration
    let audioBuffers = [];
    if (narration) {
      setActive(a => ({ ...a, status: 'generating', progress: { step: 'Generating narration…', current: 0, total: rawScenes.length } }));
      for (let i = 0; i < rawScenes.length; i++) {
        if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }
        setActive(a => ({ ...a, progress: { step: 'Generating narration…', current: i + 1, total: rawScenes.length } }));
        const buf = await fetchSceneAudio(rawScenes[i], voice || 'Brian');
        audioBuffers.push(buf);
      }
    }

    if (abortRef.current) { setActive(a => ({ ...a, status: 'cancelled' })); return; }

    // Phase 3: record video
    setActive(a => ({ ...a, status: 'recording', progress: { step: 'Recording video…', current: 0, total: scenes.length } }));

    try {
      const videoUrl = await renderVideo(scenes, sceneDurations, (current, total) => {
        setActive(a => ({ ...a, progress: { step: 'Recording video…', current, total } }));
      }, audioBuffers);

      const done = { ...initial, scenes, status: 'done', videoUrl, progress: { step: 'Done', current: scenes.length, total: scenes.length } };
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
