import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const DataContext = createContext(null);

const TASK_CATEGORIES = [
  { id: 'deep_work', label: 'Deep Work', color: '#6366f1' },
  { id: 'meetings', label: 'Meetings', color: '#f59e0b' },
  { id: 'admin', label: 'Admin / Email', color: '#10b981' },
  { id: 'learning', label: 'Learning', color: '#3b82f6' },
  { id: 'planning', label: 'Planning', color: '#8b5cf6' },
  { id: 'break', label: 'Break', color: '#ef4444' },
  { id: 'other', label: 'Other', color: '#6b7280' },
];

function loadFromStorage() {
  if (window.electronAPI) return null; // will load via IPC
  try {
    const raw = localStorage.getItem('productivity-data');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(data) {
  if (window.electronAPI) {
    window.electronAPI.saveData(data);
    return;
  }
  try {
    localStorage.setItem('productivity-data', JSON.stringify(data));
  } catch {}
}

export function DataProvider({ children }) {
  const [employees, setEmployees] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSessions, setActiveSessions] = useState({});
  const [loaded, setLoaded] = useState(false);

  // Load data
  useEffect(() => {
    async function load() {
      let data = null;
      if (window.electronAPI) {
        data = await window.electronAPI.loadData();
      } else {
        data = loadFromStorage();
      }
      if (data) {
        setEmployees(data.employees || []);
        setSessions(data.sessions || []);
      }
      setLoaded(true);
    }
    load();
  }, []);

  // Save whenever data changes
  useEffect(() => {
    if (!loaded) return;
    saveToStorage({ employees, sessions });
  }, [employees, sessions, loaded]);

  const addEmployee = useCallback((name, role, department) => {
    const emp = {
      id: uuidv4(),
      name: name.trim(),
      role: role.trim(),
      department: department.trim(),
      createdAt: new Date().toISOString(),
      avatar: name.trim().charAt(0).toUpperCase(),
    };
    setEmployees(prev => [...prev, emp]);
    return emp;
  }, []);

  const removeEmployee = useCallback((id) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    setSessions(prev => prev.filter(s => s.employeeId !== id));
    setActiveSessions(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const startSession = useCallback((employeeId, category, taskName) => {
    const session = {
      id: uuidv4(),
      employeeId,
      category,
      taskName: taskName.trim(),
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
    };
    setActiveSessions(prev => ({ ...prev, [employeeId]: session }));
  }, []);

  const stopSession = useCallback((employeeId) => {
    setActiveSessions(prev => {
      const active = prev[employeeId];
      if (!active) return prev;
      const endTime = new Date().toISOString();
      const duration = (new Date(endTime) - new Date(active.startTime)) / 1000 / 60; // minutes
      const completed = { ...active, endTime, duration: Math.round(duration) };
      setSessions(s => [...s, completed]);
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });
  }, []);

  const addManualSession = useCallback((employeeId, category, taskName, date, startHour, durationMinutes) => {
    const startTime = new Date(date);
    startTime.setHours(startHour, 0, 0, 0);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
    const session = {
      id: uuidv4(),
      employeeId,
      category,
      taskName: taskName.trim(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: durationMinutes,
    };
    setSessions(prev => [...prev, session]);
  }, []);

  const deleteSession = useCallback((id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  const getEmployeeSessions = useCallback((employeeId) => {
    return sessions.filter(s => s.employeeId === employeeId);
  }, [sessions]);

  return (
    <DataContext.Provider value={{
      employees,
      sessions,
      activeSessions,
      loaded,
      TASK_CATEGORIES,
      addEmployee,
      removeEmployee,
      startSession,
      stopSession,
      addManualSession,
      deleteSession,
      getEmployeeSessions,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
