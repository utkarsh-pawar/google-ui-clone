'use client';

const YT_HISTORY_KEY = 'yt_upload_history';

function tokenKey(channelId) {
  return channelId ? `yt_access_token_${channelId}` : 'yt_access_token';
}
function expiryKey(channelId) {
  return channelId ? `yt_token_expiry_${channelId}` : 'yt_token_expiry';
}
function refreshKey(channelId) {
  return channelId ? `yt_refresh_token_${channelId}` : 'yt_refresh_token';
}

export function getStoredToken(channelId) {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(tokenKey(channelId));
  const expiry = Number(localStorage.getItem(expiryKey(channelId)) || 0);
  if (!token || Date.now() > expiry - 60000) return null;
  return token;
}

export function isYouTubeConnected(channelId) {
  if (typeof window === 'undefined') return false;
  return !!getStoredToken(channelId) || !!localStorage.getItem(refreshKey(channelId));
}

export function disconnectYouTube(channelId) {
  localStorage.removeItem(tokenKey(channelId));
  localStorage.removeItem(expiryKey(channelId));
  localStorage.removeItem(refreshKey(channelId));
}

export async function getFreshToken(channelId) {
  let token = getStoredToken(channelId);
  if (token) return token;

  const refresh = localStorage.getItem(refreshKey(channelId));
  if (!refresh) throw new Error('YouTube not connected — please connect your channel first');

  const res = await fetch('/api/youtube/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Token refresh failed');

  localStorage.setItem(tokenKey(channelId), data.access_token);
  localStorage.setItem(expiryKey(channelId), data.expiry);
  return data.access_token;
}

export async function uploadToYouTube({ videoBlob, title, description, tags = [], channelId }) {
  const accessToken = await getFreshToken(channelId);

  const metadata = {
    snippet: {
      title: title.slice(0, 100),
      description,
      tags: tags.map(t => t.replace(/^#/, '')).slice(0, 15),
      categoryId: '27',
      defaultLanguage: 'en',
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false,
    },
  };

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

  saveUploadHistory({ videoId, videoUrl, title, channelId, uploadedAt: new Date().toISOString() });

  return { videoId, videoUrl };
}

export async function uploadThumbnail(videoId, thumbnailBlob, channelId) {
  const accessToken = await getFreshToken(channelId);
  const res = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': thumbnailBlob.type || 'image/jpeg',
        'Content-Length': thumbnailBlob.size,
      },
      body: thumbnailBlob,
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Thumbnail upload failed ${res.status}`);
  }
  return res.json();
}

export function getUploadHistory() {
  try { return JSON.parse(localStorage.getItem(YT_HISTORY_KEY) || '[]'); }
  catch { return []; }
}

export function saveUploadHistoryEntry(entry) {
  try {
    const h = getUploadHistory();
    localStorage.setItem(YT_HISTORY_KEY, JSON.stringify([entry, ...h].slice(0, 50)));
  } catch {}
}

function saveUploadHistory(entry) { saveUploadHistoryEntry(entry); }
