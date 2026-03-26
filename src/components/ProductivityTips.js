import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import './ProductivityTips.css';

function analyzeSessions(sessions, TASK_CATEGORIES) {
  if (!sessions.length) return null;

  const totalMinutes = sessions.reduce((s, x) => s + x.duration, 0);
  const byCategory = {};
  TASK_CATEGORIES.forEach(c => { byCategory[c.id] = 0; });
  sessions.forEach(s => { byCategory[s.category] = (byCategory[s.category] || 0) + s.duration; });

  const deepWork = byCategory.deep_work || 0;
  const meetings = byCategory.meetings || 0;
  const breaks = byCategory.break || 0;
  const admin = byCategory.admin || 0;

  const deepWorkPct = totalMinutes ? deepWork / totalMinutes : 0;
  const meetingPct = totalMinutes ? meetings / totalMinutes : 0;
  const breakPct = totalMinutes ? breaks / totalMinutes : 0;

  // Day-of-week pattern
  const byDay = Array(7).fill(0);
  const byDaySessions = Array(7).fill(0);
  sessions.forEach(s => {
    const day = new Date(s.startTime).getDay();
    byDay[day] += s.duration;
    byDaySessions[day]++;
  });

  // Hour pattern
  const byHour = Array(24).fill(0);
  sessions.forEach(s => { byHour[new Date(s.startTime).getHours()] += s.duration; });
  const peakHour = byHour.indexOf(Math.max(...byHour));

  // Session length
  const avgSessionLen = totalMinutes / sessions.length;

  // Unique days tracked
  const uniqueDays = [...new Set(sessions.map(s => s.startTime.split('T')[0]))].length;
  const avgDailyHours = uniqueDays ? totalMinutes / uniqueDays / 60 : 0;

  // Last 7 days tracked
  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  });
  const daysTracked7 = [...new Set(sessions.filter(s => last7.includes(s.startTime.split('T')[0])).map(s => s.startTime.split('T')[0]))].length;

  return { totalMinutes, deepWorkPct, meetingPct, breakPct, peakHour, avgSessionLen, avgDailyHours, daysTracked7, byDay, byHour, deepWork, meetings, breaks, admin, uniqueDays };
}

function generateTips(analysis) {
  if (!analysis) return [];
  const tips = [];
  const { deepWorkPct, meetingPct, breakPct, peakHour, avgSessionLen, avgDailyHours, daysTracked7, byDay } = analysis;

  // Deep work tips
  if (deepWorkPct < 0.25) {
    tips.push({
      type: 'warning',
      icon: '🧠',
      title: 'Increase Deep Work Time',
      body: `Only ${Math.round(deepWorkPct * 100)}% of tracked time is deep work. Aim for at least 25–35%. Try blocking 2-3 hour uninterrupted windows in the morning for focused tasks.`,
      score: 3,
    });
  } else if (deepWorkPct >= 0.35) {
    tips.push({
      type: 'success',
      icon: '🧠',
      title: 'Excellent Deep Work Ratio',
      body: `${Math.round(deepWorkPct * 100)}% of time is deep work — well above the recommended minimum. Keep protecting focused work blocks.`,
      score: 1,
    });
  }

  // Meeting overload
  if (meetingPct > 0.4) {
    tips.push({
      type: 'warning',
      icon: '📅',
      title: 'Meeting Overload Detected',
      body: `${Math.round(meetingPct * 100)}% of time is spent in meetings. Consider batching meetings on 2–3 days per week to protect deep work time on others. Audit recurring meetings for necessity.`,
      score: 3,
    });
  } else if (meetingPct > 0.25) {
    tips.push({
      type: 'info',
      icon: '📅',
      title: 'Meetings Taking Significant Time',
      body: `${Math.round(meetingPct * 100)}% of time in meetings. Consider setting a personal meeting budget and declining optional meetings when in a focus sprint.`,
      score: 2,
    });
  }

  // Break pattern
  if (breakPct < 0.05) {
    tips.push({
      type: 'warning',
      icon: '☕',
      title: 'Take More Breaks',
      body: 'Very few breaks are being logged. Regular breaks improve sustained focus. Try the Pomodoro technique: 25 min work, 5 min break — or a 90-minute focus block with a 15-min break.',
      score: 2,
    });
  }

  // Peak hour insight
  if (peakHour >= 6 && peakHour <= 11) {
    tips.push({
      type: 'success',
      icon: '⏰',
      title: 'Morning Peak Productivity',
      body: `Most work happens around ${peakHour}:00 — a morning person pattern. Schedule your most demanding cognitive tasks before noon and use afternoons for collaboration and admin.`,
      score: 1,
    });
  } else if (peakHour >= 14 && peakHour <= 18) {
    tips.push({
      type: 'info',
      icon: '⏰',
      title: 'Afternoon Peak Productivity',
      body: `Peak work happens around ${peakHour}:00. Schedule deep work in the afternoon and use mornings for planning, email, and lighter tasks. Protect that afternoon focus window.`,
      score: 1,
    });
  } else if (peakHour >= 19) {
    tips.push({
      type: 'warning',
      icon: '🌙',
      title: 'Late Night Work Pattern',
      body: `Significant work is happening after 7 PM. While night owl patterns can be productive, ensure adequate rest. Consider whether late sessions reflect poor daytime focus or boundary issues.`,
      score: 2,
    });
  }

  // Session length
  if (avgSessionLen < 20) {
    tips.push({
      type: 'warning',
      icon: '⚡',
      title: 'Sessions Too Short',
      body: `Average session length is only ${Math.round(avgSessionLen)} minutes. Very short sessions may indicate frequent interruptions. Deep cognitive work requires at least 45–90 min of sustained focus to reach flow state.`,
      score: 3,
    });
  } else if (avgSessionLen > 150) {
    tips.push({
      type: 'info',
      icon: '⚡',
      title: 'Very Long Sessions',
      body: `Sessions average ${Math.round(avgSessionLen / 60 * 10) / 10}h. Long unbroken sessions can reduce cognitive quality. Consider adding short breaks every 90 minutes to maintain peak performance.`,
      score: 2,
    });
  }

  // Daily hours
  if (avgDailyHours > 9) {
    tips.push({
      type: 'warning',
      icon: '🚨',
      title: 'Overwork Risk',
      body: `Averaging ${Math.round(avgDailyHours * 10) / 10}h/day. Sustained overwork leads to burnout and reduced quality. Encourage setting a hard stop time and taking actual offline time.`,
      score: 3,
    });
  } else if (avgDailyHours < 4 && daysTracked7 >= 3) {
    tips.push({
      type: 'info',
      icon: '📊',
      title: 'Low Daily Hours',
      body: `Tracking only ${Math.round(avgDailyHours * 10) / 10}h/day on average. This could be incomplete tracking, part-time schedule, or disengagement. Encourage complete time tracking for better insights.`,
      score: 2,
    });
  }

  // Consistency
  if (daysTracked7 >= 5) {
    tips.push({
      type: 'success',
      icon: '🎯',
      title: 'Consistent Tracker',
      body: 'Tracked on 5+ of the last 7 days — great consistency! Regular tracking provides the most accurate pattern analysis and helps identify sustainable work rhythms.',
      score: 1,
    });
  } else if (daysTracked7 <= 2) {
    tips.push({
      type: 'info',
      icon: '📝',
      title: 'Improve Tracking Consistency',
      body: 'Only tracked on a few days recently. More consistent tracking enables better pattern detection and more accurate productivity insights. Set a reminder to start sessions each morning.',
      score: 2,
    });
  }

  // Weekend work
  const weekendWork = byDay[0] + byDay[6];
  if (weekendWork > 120) {
    tips.push({
      type: 'warning',
      icon: '🏖️',
      title: 'Weekend Work Detected',
      body: `${Math.round(weekendWork / 60 * 10) / 10}h tracked on weekends. While occasional weekend work is normal, habitual weekend working reduces recovery time and long-term productivity. Protect personal time.`,
      score: 2,
    });
  }

  // Sort by score (higher = more important)
  return tips.sort((a, b) => b.score - a.score);
}

function getOverallScore(analysis) {
  if (!analysis) return null;
  let score = 70; // base
  if (analysis.deepWorkPct >= 0.3) score += 10;
  else if (analysis.deepWorkPct < 0.15) score -= 15;
  if (analysis.meetingPct > 0.4) score -= 10;
  if (analysis.breakPct >= 0.05) score += 5;
  if (analysis.avgDailyHours <= 8.5 && analysis.avgDailyHours >= 5) score += 5;
  else if (analysis.avgDailyHours > 9.5) score -= 10;
  if (analysis.avgSessionLen >= 30 && analysis.avgSessionLen <= 120) score += 5;
  else if (analysis.avgSessionLen < 20) score -= 10;
  if (analysis.daysTracked7 >= 5) score += 5;
  return Math.max(10, Math.min(100, score));
}

export default function ProductivityTips({ employeeId }) {
  const { employees, sessions, TASK_CATEGORIES } = useData();
  const employee = employees.find(e => e.id === employeeId);
  const empSessions = useMemo(() => sessions.filter(s => s.employeeId === employeeId), [sessions, employeeId]);
  const analysis = useMemo(() => analyzeSessions(empSessions, TASK_CATEGORIES), [empSessions, TASK_CATEGORIES]);
  const tips = useMemo(() => generateTips(analysis), [analysis]);
  const score = useMemo(() => getOverallScore(analysis), [analysis]);

  if (!employee) return null;

  const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const scoreLabel = score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 45 ? 'Fair' : 'Needs Attention';

  return (
    <div className="pt-container">
      <div className="pt-header">
        <h2>Productivity Tips & Insights</h2>
        <span>{employee.name}</span>
      </div>

      {!analysis ? (
        <div className="pt-empty">
          <div className="pt-empty-icon">💡</div>
          <p>Track at least a few sessions to generate personalized productivity insights.</p>
        </div>
      ) : (
        <>
          {/* Score card */}
          <div className="pt-score-card">
            <div className="pt-score-ring" style={{ '--score-color': scoreColor, '--score-pct': score }}>
              <svg viewBox="0 0 120 120" className="pt-ring-svg">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#1e293b" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke={scoreColor} strokeWidth="10"
                  strokeDasharray={`${score * 3.14} 314`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="pt-score-inner">
                <span className="pt-score-num" style={{ color: scoreColor }}>{score}</span>
                <span className="pt-score-label">{scoreLabel}</span>
              </div>
            </div>
            <div className="pt-score-details">
              <h3>Productivity Score</h3>
              <p>Based on work patterns, deep focus ratio, meeting load, break habits, and daily consistency. Higher scores indicate healthier and more sustainable productivity patterns.</p>
              <div className="pt-score-metrics">
                <div className="pt-metric">
                  <span>Deep Work</span>
                  <div className="pt-bar"><div style={{ width: `${Math.min(100, analysis.deepWorkPct * 100 / 0.35 * 100)}%`, background: '#6366f1' }} /></div>
                  <span>{Math.round(analysis.deepWorkPct * 100)}%</span>
                </div>
                <div className="pt-metric">
                  <span>Meeting Load</span>
                  <div className="pt-bar"><div style={{ width: `${Math.min(100, analysis.meetingPct * 100 / 0.4 * 100)}%`, background: '#f59e0b' }} /></div>
                  <span>{Math.round(analysis.meetingPct * 100)}%</span>
                </div>
                <div className="pt-metric">
                  <span>Daily Hours</span>
                  <div className="pt-bar"><div style={{ width: `${Math.min(100, analysis.avgDailyHours / 8 * 100)}%`, background: '#10b981' }} /></div>
                  <span>{Math.round(analysis.avgDailyHours * 10) / 10}h avg</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tips list */}
          <div className="pt-tips">
            <h3>{tips.length} Personalized Recommendations</h3>
            {tips.map((tip, i) => (
              <div key={i} className={`pt-tip-card ${tip.type}`}>
                <div className="pt-tip-icon">{tip.icon}</div>
                <div className="pt-tip-body">
                  <div className="pt-tip-title">{tip.title}</div>
                  <div className="pt-tip-text">{tip.body}</div>
                </div>
                <div className={`pt-tip-badge ${tip.type}`}>
                  {tip.type === 'warning' ? 'Action Needed' : tip.type === 'success' ? 'Great' : 'Tip'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
