import React, { useState } from 'react';
import { DataProvider } from './context/DataContext';
import ProductivityTrackerApp from './apps/ProductivityTrackerApp';
import SplitWise from './apps/SplitWise/SplitWise';
import './App.css';

const APPS = [
  {
    id: 'productivity-tracker',
    name: 'Productivity Tracker',
    icon: '⚡',
    description: 'Track employee work sessions, analyze patterns, and get smart productivity insights.',
    color: '#6366f1',
  },
  {
    id: 'split-wise',
    name: 'SplitWise',
    icon: '💸',
    description: 'Split trip or group expenses fairly. See exactly who owes whom and how much.',
    color: '#10b981',
  },
  {
    id: 'location-share',
    name: 'Location Share',
    icon: '📍',
    description: 'Share your live location for 30 minutes. Send a link — anyone can track you in real time.',
    color: '#f59e0b',
    externalUrl: process.env.REACT_APP_LOCATION_SHARE_URL || 'http://localhost:3001',
  },
];

function Launcher({ onOpen }) {
  return (
    <div className="launcher">
      <header className="launcher-header">
        <div className="launcher-brand">My Apps</div>
        <div className="launcher-sub">{APPS.length} apps</div>
      </header>
      <div className="launcher-grid">
        {APPS.map(app => (
          <button
            key={app.id}
            className="app-card"
            onClick={() => app.externalUrl ? window.open(app.externalUrl, '_blank') : onOpen(app.id)}
          >
            <div className="app-card-icon" style={{ background: app.color }}>{app.icon}</div>
            <div className="app-card-info">
              <div className="app-card-name">{app.name}</div>
              <div className="app-card-desc">{app.description}</div>
            </div>
            <div className="app-card-arrow">{app.externalUrl ? '↗' : '→'}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function getInitialApp() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('share')) return 'split-wise';
  return null;
}

export default function App() {
  const [activeApp, setActiveApp] = useState(getInitialApp);
  const back = () => {
    window.history.replaceState(null, '', window.location.pathname);
    setActiveApp(null);
  };

  if (activeApp === 'productivity-tracker') {
    return (
      <DataProvider>
        <ProductivityTrackerApp onBack={back} />
      </DataProvider>
    );
  }

  if (activeApp === 'split-wise') {
    return <SplitWise onBack={back} />;
  }

  return <Launcher onOpen={setActiveApp} />;
}
