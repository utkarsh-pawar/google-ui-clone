import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { useData } from '../context/DataContext';
import './WorkPatternAnalysis.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHours(minutes) {
  const h = (minutes / 60).toFixed(1);
  return `${h}h`;
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function getLast4Weeks() {
  const weeks = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    weeks.push(`W${Math.ceil(d.getDate() / 7)}`);
  }
  return weeks;
}

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12}>{`${(percent * 100).toFixed(0)}%`}</text>;
};

export default function WorkPatternAnalysis({ employeeId }) {
  const { employees, sessions, TASK_CATEGORIES } = useData();
  const [view, setView] = useState('week'); // week | month | all
  const employee = employees.find(e => e.id === employeeId);

  const empSessions = useMemo(() => sessions.filter(s => s.employeeId === employeeId), [sessions, employeeId]);

  // Category distribution
  const categoryData = useMemo(() => {
    const totals = {};
    empSessions.forEach(s => {
      totals[s.category] = (totals[s.category] || 0) + s.duration;
    });
    return TASK_CATEGORIES
      .filter(c => totals[c.id])
      .map(c => ({ name: c.label, value: totals[c.id], color: c.color }));
  }, [empSessions, TASK_CATEGORIES]);

  // Daily data for last 7 days
  const dailyData = useMemo(() => {
    const last7 = getLast7Days();
    return last7.map(dateStr => {
      const dayName = DAYS[new Date(dateStr + 'T12:00:00').getDay()];
      const daySessions = empSessions.filter(s => s.startTime.startsWith(dateStr));
      const byCategory = {};
      TASK_CATEGORIES.forEach(c => { byCategory[c.id] = 0; });
      daySessions.forEach(s => { byCategory[s.category] = (byCategory[s.category] || 0) + s.duration; });
      const total = daySessions.reduce((sum, s) => sum + s.duration, 0);
      return { date: dayName, total: Math.round(total), ...Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, Math.round(v)])) };
    });
  }, [empSessions, TASK_CATEGORIES]);

  // Peak hours (0–23)
  const peakHoursData = useMemo(() => {
    const counts = Array(24).fill(0);
    empSessions.forEach(s => {
      const hour = new Date(s.startTime).getHours();
      counts[hour] += s.duration;
    });
    return counts.map((val, hour) => ({
      hour: `${hour}:00`,
      minutes: Math.round(val),
    })).filter((_, i) => i >= 6 && i <= 22);
  }, [empSessions]);

  // Weekly trend
  const weeklyTrend = useMemo(() => {
    const weeks = {};
    empSessions.forEach(s => {
      const d = new Date(s.startTime);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split('T')[0];
      weeks[key] = (weeks[key] || 0) + s.duration;
    });
    return Object.entries(weeks).sort().slice(-8).map(([date, minutes]) => ({
      week: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      hours: Math.round(minutes / 60 * 10) / 10,
    }));
  }, [empSessions]);

  // Summary stats
  const stats = useMemo(() => {
    if (!empSessions.length) return null;
    const totalMinutes = empSessions.reduce((s, x) => s + x.duration, 0);
    const days = [...new Set(empSessions.map(s => s.startTime.split('T')[0]))].length;
    const avgPerDay = days ? Math.round(totalMinutes / days) : 0;
    const deepWork = empSessions.filter(s => s.category === 'deep_work').reduce((s, x) => s + x.duration, 0);
    const meetings = empSessions.filter(s => s.category === 'meetings').reduce((s, x) => s + x.duration, 0);
    const deepWorkPct = totalMinutes ? Math.round(deepWork / totalMinutes * 100) : 0;
    return { totalMinutes, days, avgPerDay, deepWork, meetings, deepWorkPct };
  }, [empSessions]);

  if (!employee) return null;

  if (empSessions.length === 0) {
    return (
      <div className="wpa-container">
        <div className="wpa-header">
          <h2>Work Pattern Analysis</h2>
          <span>{employee.name}</span>
        </div>
        <div className="wpa-empty">
          <div className="wpa-empty-icon">📊</div>
          <p>No sessions recorded yet. Start tracking work sessions to see analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wpa-container">
      <div className="wpa-header">
        <h2>Work Pattern Analysis</h2>
        <span>{employee.name} · {employee.role}</span>
      </div>

      {/* Summary stats */}
      {stats && (
        <div className="wpa-stats-grid">
          <div className="wpa-stat-card">
            <div className="wpa-stat-icon">⏱️</div>
            <div className="wpa-stat-value">{formatHours(stats.totalMinutes)}</div>
            <div className="wpa-stat-label">Total Tracked</div>
          </div>
          <div className="wpa-stat-card">
            <div className="wpa-stat-icon">📅</div>
            <div className="wpa-stat-value">{stats.days}</div>
            <div className="wpa-stat-label">Days Tracked</div>
          </div>
          <div className="wpa-stat-card">
            <div className="wpa-stat-icon">📈</div>
            <div className="wpa-stat-value">{formatHours(stats.avgPerDay)}</div>
            <div className="wpa-stat-label">Avg per Day</div>
          </div>
          <div className="wpa-stat-card highlight">
            <div className="wpa-stat-icon">🧠</div>
            <div className="wpa-stat-value">{stats.deepWorkPct}%</div>
            <div className="wpa-stat-label">Deep Work</div>
          </div>
        </div>
      )}

      <div className="wpa-charts-grid">
        {/* Daily hours bar chart */}
        <div className="wpa-chart-card wide">
          <h3>Daily Activity (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${Math.round(v/60)}h`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }}
                formatter={(v, name) => [`${Math.round(v/60*10)/10}h`, TASK_CATEGORIES.find(c=>c.id===name)?.label || name]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} formatter={name => TASK_CATEGORIES.find(c=>c.id===name)?.label || name} />
              {TASK_CATEGORIES.map(c => (
                <Bar key={c.id} dataKey={c.id} stackId="a" fill={c.color} radius={0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie */}
        <div className="wpa-chart-card">
          <h3>Time by Category</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" labelLine={false} label={renderCustomLabel}>
                  {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }}
                  formatter={v => formatHours(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="wpa-no-data">No data</div>}
        </div>

        {/* Peak hours */}
        <div className="wpa-chart-card">
          <h3>Peak Productivity Hours</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={peakHoursData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={2} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${Math.round(v/60)}h`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }}
                formatter={v => [`${Math.round(v/60*10)/10}h`, 'Tracked']}
              />
              <Bar dataKey="minutes" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly trend */}
        {weeklyTrend.length > 1 && (
          <div className="wpa-chart-card wide">
            <h3>Weekly Hours Trend</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weeklyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${v}h`} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }}
                  formatter={v => [`${v}h`, 'Total Hours']}
                />
                <Line type="monotone" dataKey="hours" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
