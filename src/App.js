import React, { useState } from 'react';
import { DataProvider, useData } from './context/DataContext';
import EmployeeManager from './components/EmployeeManager';
import SessionTracker from './components/SessionTracker';
import WorkPatternAnalysis from './components/WorkPatternAnalysis';
import ProductivityTips from './components/ProductivityTips';
import './App.css';

const TABS = [
  { id: 'tracker', label: 'Tracker', icon: '▶' },
  { id: 'analysis', label: 'Analysis', icon: '📊' },
  { id: 'tips', label: 'Tips & Insights', icon: '💡' },
];

function AppContent() {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [activeTab, setActiveTab] = useState('tracker');
  const { employees, sessions, activeSessions, loaded } = useData();

  if (!loaded) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  const totalTrackedToday = sessions.filter(s => {
    const today = new Date().toISOString().split('T')[0];
    return s.startTime.startsWith(today);
  }).reduce((sum, s) => sum + s.duration, 0);
  const activeCount = Object.keys(activeSessions).length;

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">⚡</div>
          <div>
            <div className="brand-name">Productivity</div>
            <div className="brand-sub">Tracker</div>
          </div>
        </div>

        <div className="sidebar-stats">
          <div className="ss-item">
            <span className="ss-val">{employees.length}</span>
            <span className="ss-label">Employees</span>
          </div>
          <div className="ss-item">
            <span className="ss-val" style={{ color: activeCount > 0 ? '#10b981' : undefined }}>{activeCount}</span>
            <span className="ss-label">Active Now</span>
          </div>
          <div className="ss-item">
            <span className="ss-val">{Math.round(totalTrackedToday / 60 * 10) / 10}h</span>
            <span className="ss-label">Today Total</span>
          </div>
        </div>

        <EmployeeManager
          onSelectEmployee={(id) => { setSelectedEmployee(id); if (id) setActiveTab('tracker'); }}
          selectedEmployeeId={selectedEmployee}
        />
      </aside>

      {/* Main content */}
      <main className="main-content">
        {!selectedEmployee ? (
          <div className="welcome-screen">
            <div className="welcome-icon">⚡</div>
            <h1>Productivity Tracker</h1>
            <p>Select an employee from the sidebar to track work sessions, view patterns, and get personalized productivity insights.</p>
            <div className="welcome-features">
              <div className="feature-card">
                <div className="fc-icon">▶</div>
                <h3>Session Tracking</h3>
                <p>Start/stop work sessions with categories: deep work, meetings, breaks, admin, and more.</p>
              </div>
              <div className="feature-card">
                <div className="fc-icon">📊</div>
                <h3>Pattern Analysis</h3>
                <p>Visual charts showing daily activity, category breakdown, peak hours, and weekly trends.</p>
              </div>
              <div className="feature-card">
                <div className="fc-icon">💡</div>
                <h3>Smart Tips</h3>
                <p>Personalized productivity recommendations based on actual work patterns and habits.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <nav className="tab-nav">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="tab-content">
              {activeTab === 'tracker' && <SessionTracker employeeId={selectedEmployee} />}
              {activeTab === 'analysis' && <WorkPatternAnalysis employeeId={selectedEmployee} />}
              {activeTab === 'tips' && <ProductivityTips employeeId={selectedEmployee} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
