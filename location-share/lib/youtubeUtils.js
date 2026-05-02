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

// XHR upload — works in background tabs + gives real progress events
function xhrUpload(url, blob, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, String(v)));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve({}); }
      } else {
        let msg = `Upload failed: ${xhr.status}`;
        try { msg = JSON.parse(xhr.responseText)?.error?.message || msg; } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload was aborted'));
    xhr.send(blob);
  });
}

export async function uploadToYouTube({ videoBlob, title, description, tags = [], format = 'portrait', onProgress }) {
  const accessToken = await getFreshToken();
  const isShorts = format === 'portrait';

  // Shorts: hashtags in title = more algorithmic reach. Regular: clean title, full tags array.
  const cleanTags = tags.map(t => t.replace(/^#/, ''));
  let finalTitle, finalTags, finalDescription;

  if (isShorts) {
    // Only #Shorts in title (9 chars) — that's all YouTube needs for Shorts feed discovery
    // All other hashtags go in the description where they also count for reach
    finalTitle = title.slice(0, 91) + ' #Shorts';
    const hashtagBlock = [...new Set(['#Shorts', '#YouTubeShorts', ...tags])].join(' ');
    finalDescription = description + '\n\n' + hashtagBlock;
    finalTags = [...new Set(['Shorts', 'YouTubeShorts', ...cleanTags])].slice(0, 15);
  } else {
    finalTitle = title.slice(0, 100);
    finalDescription = description;
    finalTags = [...new Set(cleanTags)].slice(0, 15);
  }

  const metadata = {
    snippet: {
      title: finalTitle,
      description: finalDescription,
      tags: finalTags,
      categoryId: '27',
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

  // Step 2: Upload via XHR — survives background tabs + gives progress
  const result = await xhrUpload(
    uploadUrl,
    videoBlob,
    {
      'Content-Type': videoBlob.type || 'video/webm',
      'Content-Length': videoBlob.size,
    },
    onProgress,
  );

  const videoId = result.id;
  const videoUrl = `https://www.youtube.com/shorts/${videoId}`;

  saveUploadHistory({ videoId, videoUrl, title: finalTitle, uploadedAt: new Date().toISOString() });

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
