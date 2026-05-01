'use client';

const YT_TOKEN_KEY = 'yt_access_token';
const YT_EXPIRY_KEY = 'yt_token_expiry';
const YT_REFRESH_KEY = 'yt_refresh_token';
const YT_HISTORY_KEY = 'yt_upload_history';

export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(YT_TOKEN_KEY);
  const expiry = Number(localStorage.getItem(YT_EXPIRY_KEY) || 0);
  if (!token || Date.now() > expiry - 60000) return null;
  return token;
}

export function isYouTubeConnected() {
  if (typeof window === 'undefined') return false;
  return !!getStoredToken() || !!localStorage.getItem(YT_REFRESH_KEY);
}

export function disconnectYouTube() {
  localStorage.removeItem(YT_TOKEN_KEY);
  localStorage.removeItem(YT_EXPIRY_KEY);
  localStorage.removeItem(YT_REFRESH_KEY);
}

export async function getFreshToken() {
  let token = getStoredToken();
  if (token) return token;

  const refresh = localStorage.getItem(YT_REFRESH_KEY);
  if (!refresh) throw new Error('YouTube not connected — please connect your channel first');

  const res = await fetch('/api/youtube/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Token refresh failed');

  localStorage.setItem(YT_TOKEN_KEY, data.access_token);
  localStorage.setItem(YT_EXPIRY_KEY, data.expiry);
  return data.access_token;
}

// Upload a video Blob directly to YouTube from the browser
export async function uploadToYouTube({ videoBlob, title, description, tags = [] }) {
  const accessToken = await getFreshToken();

  const metadata = {
    snippet: {
      title: title.slice(0, 100),
      description,
      tags: tags.map(t => t.replace(/^#/, '')).slice(0, 15),
      categoryId: '27', // Education
      defaultLanguage: 'en',
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false,
    },
  };

  // Step 1: Initiate resumable upload session
  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': videoBlob.type || 'video/webm',
        'X-Upload-Content-Length': videoBlob.size,
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `YouTube init failed ${initRes.status}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) throw new Error('No upload URL from YouTube');

  // Step 2: Upload the video
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': videoBlob.type || 'video/webm',
      'Content-Length': videoBlob.size,
    },
    body: videoBlob,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `YouTube upload failed ${uploadRes.status}`);
  }

  const result = await uploadRes.json();
  const videoId = result.id;
  const videoUrl = `https://www.youtube.com/shorts/${videoId}`;

  // Save to local upload history
  saveUploadHistory({ videoId, videoUrl, title, uploadedAt: new Date().toISOString() });

  return { videoId, videoUrl };
}

export function getUploadHistory() {
  try { return JSON.parse(localStorage.getItem(YT_HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveUploadHistory(entry) {
  try {
    const h = getUploadHistory();
    localStorage.setItem(YT_HISTORY_KEY, JSON.stringify([entry, ...h].slice(0, 50)));
  } catch {}
}
