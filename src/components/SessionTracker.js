import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import './SessionTracker.css';

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ElapsedTimer({ startTime }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startTime)) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return (
    <span className="elapsed-timer">
      {h > 0 && `${h}h `}{m}m {String(s).padStart(2, '0')}s
    </span>
  );
}

export default function SessionTracker({ employeeId }) {
  const { employees, TASK_CATEGORIES, activeSessions, sessions, startSession, stopSession, addManualSession, deleteSession } = useData();
  const employee = employees.find(e => e.id === employeeId);
  const activeSession = activeSessions[employeeId];
  const empSessions = sessions.filter(s => s.employeeId === employeeId).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  const [category, setCategory] = useState(TASK_CATEGORIES[0].id);
  const [taskName, setTaskName] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({
    category: TASK_CATEGORIES[0].id,
    taskName: '',
    date: new Date().toISOString().split('T')[0],
    startHour: 9,
    duration: 60,
  });

  if (!employee) return null;

  function handleStart(e) {
    e.preventDefault();
    startSession(employeeId, category, taskName || TASK_CATEGORIES.find(c => c.id === category)?.label);
    setTaskName('');
  }

  function handleManualAdd(e) {
    e.preventDefault();
    addManualSession(employeeId, manual.category, manual.taskName || TASK_CATEGORIES.find(c => c.id === manual.category)?.label, manual.date, parseInt(manual.startHour), parseInt(manual.duration));
    setShowManual(false);
    setManual({ category: TASK_CATEGORIES[0].id, taskName: '', date: new Date().toISOString().split('T')[0], startHour: 9, duration: 60 });
  }

  const getCategoryColor = (catId) => TASK_CATEGORIES.find(c => c.id === catId)?.color || '#6b7280';
  const getCategoryLabel = (catId) => TASK_CATEGORIES.find(c => c.id === catId)?.label || catId;

  const totalToday = empSessions
    .filter(s => formatDate(s.startTime) === formatDate(new Date().toISOString()))
    .reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="st-container">
      <div className="st-header">
        <div className="st-employee-info">
          <div className="st-avatar">{employee.avatar}</div>
          <div>
            <h2>{employee.name}</h2>
            <span>{employee.role} · {employee.department}</span>
          </div>
        </div>
        <div className="st-today-summary">
          <div className="st-stat">
            <span className="st-stat-value">{formatDuration(totalToday)}</span>
            <span className="st-stat-label">Today's tracked</span>
          </div>
          <div className="st-stat">
            <span className="st-stat-value">{empSessions.length}</span>
            <span className="st-stat-label">Total sessions</span>
          </div>
        </div>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <div className="st-active-banner">
          <div className="st-active-info">
            <span className="pulse-dot large" />
            <div>
              <strong>Session in progress</strong>
              <div className="st-active-details">
                <span style={{ color: getCategoryColor(activeSession.category) }}>● {getCategoryLabel(activeSession.category)}</span>
                {activeSession.taskName && <span> · {activeSession.taskName}</span>}
              </div>
            </div>
          </div>
          <div className="st-active-right">
            <ElapsedTimer startTime={activeSession.startTime} />
            <button className="btn-stop" onClick={() => stopSession(employeeId)}>Stop Session</button>
          </div>
        </div>
      )}

      {/* Start session */}
      {!activeSession && (
        <form className="st-start-form" onSubmit={handleStart}>
          <h3>Start New Session</h3>
          <div className="st-form-row">
            <div className="st-field">
              <label>Category</label>
              <div className="category-grid">
                {TASK_CATEGORIES.map(cat => (
                  <button
                    type="button"
                    key={cat.id}
                    className={`cat-btn ${category === cat.id ? 'selected' : ''}`}
                    style={{ '--cat-color': cat.color }}
                    onClick={() => setCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="st-field">
              <label>Task Description (optional)</label>
              <input
                type="text"
                placeholder="What are you working on?"
                value={taskName}
                onChange={e => setTaskName(e.target.value)}
              />
            </div>
          </div>
          <div className="st-form-actions">
            <button type="submit" className="btn-primary btn-start">▶ Start Tracking</button>
            <button type="button" className="btn-secondary" onClick={() => setShowManual(!showManual)}>
              + Log Past Session
            </button>
          </div>
        </form>
      )}

      {/* Manual session form */}
      {showManual && (
        <form className="st-manual-form" onSubmit={handleManualAdd}>
          <h3>Log Past Session</h3>
          <div className="st-form-row">
            <div className="st-field">
              <label>Category</label>
              <select value={manual.category} onChange={e => setManual(m => ({ ...m, category: e.target.value }))}>
                {TASK_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="st-field">
              <label>Task Description</label>
              <input type="text" placeholder="Task name" value={manual.taskName} onChange={e => setManual(m => ({ ...m, taskName: e.target.value }))} />
            </div>
            <div className="st-field">
              <label>Date</label>
              <input type="date" value={manual.date} onChange={e => setManual(m => ({ ...m, date: e.target.value }))} />
            </div>
            <div className="st-field">
              <label>Start Hour (0–23)</label>
              <input type="number" min="0" max="23" value={manual.startHour} onChange={e => setManual(m => ({ ...m, startHour: e.target.value }))} />
            </div>
            <div className="st-field">
              <label>Duration (minutes)</label>
              <input type="number" min="1" max="480" value={manual.duration} onChange={e => setManual(m => ({ ...m, duration: e.target.value }))} />
            </div>
          </div>
          <div className="st-form-actions">
            <button type="submit" className="btn-primary">Save Session</button>
            <button type="button" className="btn-secondary" onClick={() => setShowManual(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Session history */}
      <div className="st-history">
        <h3>Session History ({empSessions.length})</h3>
        {empSessions.length === 0 && (
          <div className="st-empty">No sessions logged yet. Start a session above.</div>
        )}
        <div className="st-session-list">
          {empSessions.slice(0, 30).map(session => (
            <div key={session.id} className="st-session-item">
              <div className="st-session-cat" style={{ background: getCategoryColor(session.category) + '22', color: getCategoryColor(session.category) }}>
                {getCategoryLabel(session.category)}
              </div>
              <div className="st-session-info">
                <div className="st-session-task">{session.taskName}</div>
                <div className="st-session-meta">
                  {formatDate(session.startTime)} · {formatTime(session.startTime)} – {session.endTime ? formatTime(session.endTime) : 'ongoing'}
                </div>
              </div>
              <div className="st-session-dur">{formatDuration(session.duration)}</div>
              <button className="btn-delete-small" onClick={() => deleteSession(session.id)} title="Delete session">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
