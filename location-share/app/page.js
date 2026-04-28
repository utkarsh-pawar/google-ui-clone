'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './page.module.css';

const DURATION = 30 * 60;

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function Home() {
  const [status, setStatus] = useState('idle'); // idle | requesting | sharing | stopped | error
  const [sessionId, setSessionId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [coords, setCoords] = useState(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const watchRef = useRef(null);
  const timerRef = useRef(null);
  const sessionRef = useRef(null);

  const stopSharing = useCallback(() => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    watchRef.current = null;
    timerRef.current = null;
    setStatus('stopped');
  }, []);

  const startSharing = async () => {
    setStatus('requesting');
    setErrorMsg('');

    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      setStatus('error');
      return;
    }

    let res;
    try {
      res = await fetch('/api/session', { method: 'POST' });
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
      return;
    }

    const { id } = await res.json();
    setSessionId(id);
    sessionRef.current = id;
    setTimeLeft(DURATION);
    setStatus('sharing');

    watchRef.current = navigator.geolocation.watchPosition(
      ({ coords: c }) => {
        const { latitude: lat, longitude: lng, accuracy } = c;
        setCoords({ lat, lng, accuracy });
        fetch(`/api/session/${sessionRef.current}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, accuracy }),
        });
      },
      (err) => {
        setErrorMsg(err.code === 1 ? 'Location permission denied.' : err.message);
        setStatus('error');
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 10000 }
    );

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { stopSharing(); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(() => () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const copyLink = () => {
    const url = `${window.location.origin}/view/${sessionId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const urgency = timeLeft < 300 ? 'red' : timeLeft < 600 ? 'yellow' : 'green';

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>📍</div>
        <h1 className={styles.title}>Location Share</h1>
        <p className={styles.sub}>Share your live location for 30 minutes. Anyone with the link can see where you are.</p>

        {status === 'idle' && (
          <button className={styles.btnPrimary} onClick={startSharing}>
            Start Sharing
          </button>
        )}

        {status === 'requesting' && (
          <div className={styles.requesting}>
            <div className={styles.spinner} />
            <span>Requesting location permission…</span>
          </div>
        )}

        {status === 'sharing' && (
          <div className={styles.sharingPanel}>
            <div className={styles.timerRow}>
              <span className={styles.timerLabel}>Expires in</span>
              <span className={`${styles.timer} ${styles[urgency]}`}>{fmt(timeLeft)}</span>
            </div>

            <div className={styles.progressBar}>
              <div
                className={`${styles.progressFill} ${styles[urgency]}`}
                style={{ width: `${(timeLeft / DURATION) * 100}%` }}
              />
            </div>

            {coords && (
              <div className={styles.coords}>
                <span>{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</span>
                {coords.accuracy && <span className={styles.accuracy}>±{Math.round(coords.accuracy)}m</span>}
              </div>
            )}

            {!coords && (
              <div className={styles.locating}>
                <div className={styles.spinner} />
                <span>Acquiring GPS signal…</span>
              </div>
            )}

            <button
              className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}
              onClick={copyLink}
              disabled={!coords}
            >
              {copied ? '✓ Link copied!' : '🔗 Copy share link'}
            </button>

            <div className={styles.shareUrl}>
              {window && sessionId && `${window.location.origin}/view/${sessionId}`}
            </div>

            <button className={styles.btnStop} onClick={stopSharing}>
              Stop Sharing
            </button>
          </div>
        )}

        {status === 'stopped' && (
          <div className={styles.stoppedPanel}>
            <div className={styles.stoppedIcon}>🔴</div>
            <p className={styles.stoppedText}>Location sharing has ended.</p>
            <button className={styles.btnPrimary} onClick={() => { setStatus('idle'); setCoords(null); setSessionId(null); }}>
              Start New Session
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className={styles.errorPanel}>
            <div className={styles.errorIcon}>⚠️</div>
            <p className={styles.errorText}>{errorMsg}</p>
            <button className={styles.btnPrimary} onClick={() => setStatus('idle')}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
