'use client';
import { useRouter } from 'next/navigation';
import styles from './launcher.module.css';

const APPS = [
  {
    id: 'productivity-tracker',
    name: 'Productivity Tracker',
    icon: '⚡',
    description: 'Track employee work sessions, analyze patterns, and get smart productivity insights.',
    color: '#6366f1',
    href: '/productivity-tracker',
  },
  {
    id: 'split-wise',
    name: 'SplitWise',
    icon: '💸',
    description: 'Split trip or group expenses fairly. See exactly who owes whom and how much.',
    color: '#10b981',
    href: '/split-wise',
  },
  {
    id: 'location-share',
    name: 'Location Share',
    icon: '📍',
    description: 'Share your live location for 30 minutes. Send a link — anyone can track you in real time.',
    color: '#f59e0b',
    href: '/location-share',
  },
];

export default function Launcher() {
  const router = useRouter();
  return (
    <div className={styles.launcher}>
      <header className={styles.header}>
        <div className={styles.brand}>My Apps</div>
        <div className={styles.sub}>{APPS.length} apps</div>
      </header>
      <div className={styles.grid}>
        {APPS.map(app => (
          <button key={app.id} className={styles.card} onClick={() => router.push(app.href)}>
            <div className={styles.icon} style={{ background: app.color }}>{app.icon}</div>
            <div className={styles.info}>
              <div className={styles.name}>{app.name}</div>
              <div className={styles.desc}>{app.description}</div>
            </div>
            <div className={styles.arrow}>→</div>
          </button>
        ))}
      </div>
    </div>
  );
}
