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
          <button key={app.id} className="app-card" onClick={() => onOpen(app.id)}>
            <div className="app-card-icon" style={{ background: app.color }}>{app.icon}</div>
            <div className="app-card-info">
              <div className="app-card-name">{app.name}</div>
              <div className="app-card-desc">{app.description}</div>
            </div>
            <div className="app-card-arrow">→</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [activeApp, setActiveApp] = useState(null);
  const back = () => setActiveApp(null);

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
