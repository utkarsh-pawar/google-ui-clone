'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import styles from './view.module.css';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

function timeAgo(ts) {
  if (!ts) return null;
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function timeLeft(expiresAt) {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function ViewPage({ params }) {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | waiting | active | expired
  const [tick, setTick] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/session/${params.id}`, { cache: 'no-store' });
        if (res.status === 404) { setStatus('expired'); clearInterval(intervalRef.current); return; }
        const data = await res.json();
        setLocation(data);
        setStatus(data.lat != null ? 'active' : 'waiting');
      } catch {
        setStatus('expired');
        clearInterval(intervalRef.current);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 5000);
    const ticker = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(intervalRef.current); clearInterval(ticker); };
  }, [params.id]);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.topLogo}>📍</span>
          <span className={styles.topTitle}>Live Location</span>
        </div>
        <div className={styles.topRight}>
          {status === 'active' && location && (
            <>
              <span className={styles.pulseDot} />
              <span className={styles.topMeta}>
                Updated {timeAgo(location.updatedAt)} · expires in {timeLeft(location.expiresAt)}
              </span>
            </>
          )}
          {status === 'waiting' && <span className={styles.topMeta}>Waiting for location…</span>}
          {status === 'expired' && <span className={styles.expiredBadge}>Session ended</span>}
          {status === 'loading' && <span className={styles.topMeta}>Connecting…</span>}
        </div>
      </div>

      <div className={styles.mapWrap}>
        {status === 'active' && location?.lat != null && (
          <Map lat={location.lat} lng={location.lng} accuracy={location.accuracy || 0} />
        )}

        {(status === 'loading' || status === 'waiting') && (
          <div className={styles.overlay}>
            <div className={styles.spinner} />
            <p>{status === 'loading' ? 'Connecting to session…' : 'Waiting for the sharer to get a GPS fix…'}</p>
          </div>
        )}

        {status === 'expired' && (
          <div className={styles.overlay}>
            <div className={styles.expiredIcon}>🔴</div>
            <p className={styles.expiredTitle}>Session has ended</p>
            <p className={styles.expiredSub}>The 30-minute location sharing window has expired.</p>
          </div>
        )}
      </div>

      {status === 'active' && location && (
        <div className={styles.bottomBar}>
          <span className={styles.coordText}>
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </span>
          {location.accuracy && (
            <span className={styles.accuracyText}>±{Math.round(location.accuracy)}m</span>
          )}
        </div>
      )}
    </div>
  );
}
