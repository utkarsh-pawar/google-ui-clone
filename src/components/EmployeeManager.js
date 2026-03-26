import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import './EmployeeManager.css';

const DEPARTMENTS = ['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Product'];

export default function EmployeeManager({ onSelectEmployee, selectedEmployeeId }) {
  const { employees, addEmployee, removeEmployee, activeSessions } = useData();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', department: DEPARTMENTS[0] });
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.role.trim()) { setError('Role is required'); return; }
    addEmployee(form.name, form.role, form.department);
    setForm({ name: '', role: '', department: DEPARTMENTS[0] });
    setShowForm(false);
    setError('');
  }

  function handleDelete(id) {
    if (confirmDelete === id) {
      removeEmployee(id);
      setConfirmDelete(null);
      if (selectedEmployeeId === id) onSelectEmployee(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  }

  const avatarColors = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6'];

  return (
    <div className="em-container">
      <div className="em-header">
        <div>
          <h2>Employees</h2>
          <span className="em-count">{employees.length} team members</span>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Add Employee'}
        </button>
      </div>

      {showForm && (
        <form className="em-form" onSubmit={handleSubmit}>
          <h3>New Employee</h3>
          {error && <p className="em-error">{error}</p>}
          <div className="em-form-row">
            <div className="em-field">
              <label>Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Jane Smith"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="em-field">
              <label>Role *</label>
              <input
                type="text"
                placeholder="e.g. Senior Engineer"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              />
            </div>
            <div className="em-field">
              <label>Department</label>
              <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary">Add Employee</button>
        </form>
      )}

      <div className="em-list">
        {employees.length === 0 && (
          <div className="em-empty">
            <div className="em-empty-icon">👤</div>
            <p>No employees yet. Add your first team member to start tracking.</p>
          </div>
        )}
        {employees.map((emp, idx) => {
          const isActive = !!activeSessions[emp.id];
          const isSelected = selectedEmployeeId === emp.id;
          const color = avatarColors[idx % avatarColors.length];
          return (
            <div
              key={emp.id}
              className={`em-card ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
              onClick={() => onSelectEmployee(emp.id === selectedEmployeeId ? null : emp.id)}
            >
              <div className="em-avatar" style={{ background: color }}>
                {emp.avatar}
              </div>
              <div className="em-info">
                <div className="em-name">{emp.name}</div>
                <div className="em-role">{emp.role} · {emp.department}</div>
                {isActive && (
                  <div className="em-active-badge">
                    <span className="pulse-dot" />
                    Tracking: {activeSessions[emp.id]?.taskName || activeSessions[emp.id]?.category}
                  </div>
                )}
              </div>
              <div className="em-actions" onClick={e => e.stopPropagation()}>
                <button
                  className={`btn-delete ${confirmDelete === emp.id ? 'confirm' : ''}`}
                  onClick={() => handleDelete(emp.id)}
                  title={confirmDelete === emp.id ? 'Click again to confirm' : 'Remove employee'}
                >
                  {confirmDelete === emp.id ? 'Confirm?' : '✕'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
