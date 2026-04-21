import React, { useState } from 'react';
import './SplitWise.css';

function settle(people, expenses) {
  const balance = {};
  people.forEach(p => (balance[p] = 0));

  expenses.forEach(({ paidBy, amount, splitAmong }) => {
    const share = amount / splitAmong.length;
    balance[paidBy] = (balance[paidBy] || 0) + amount;
    splitAmong.forEach(p => {
      balance[p] = (balance[p] || 0) - share;
    });
  });

  const creditors = [];
  const debtors = [];
  Object.entries(balance).forEach(([name, amt]) => {
    const rounded = Math.round(amt * 100) / 100;
    if (rounded > 0.01) creditors.push({ name, amt: rounded });
    else if (rounded < -0.01) debtors.push({ name, amt: -rounded });
  });

  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transactions = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].amt, debtors[j].amt);
    transactions.push({ from: debtors[j].name, to: creditors[i].name, amount: Math.round(amount * 100) / 100 });
    creditors[i].amt -= amount;
    debtors[j].amt -= amount;
    if (creditors[i].amt < 0.01) i++;
    if (debtors[j].amt < 0.01) j++;
  }
  return transactions;
}

const STEPS = ['People', 'Expenses', 'Settlement'];

export default function SplitWise({ onBack }) {
  const [step, setStep] = useState(0);
  const [tripName, setTripName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [people, setPeople] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({ desc: '', amount: '', paidBy: '', splitAmong: [] });
  const [settled, setSettled] = useState(false);

  const addPerson = () => {
    const name = nameInput.trim();
    if (!name || people.includes(name)) return;
    const updated = [...people, name];
    setPeople(updated);
    setForm(f => ({ ...f, paidBy: f.paidBy || name, splitAmong: updated }));
    setNameInput('');
  };

  const removePerson = (name) => {
    const updated = people.filter(p => p !== name);
    setPeople(updated);
    setForm(f => ({
      ...f,
      paidBy: f.paidBy === name ? (updated[0] || '') : f.paidBy,
      splitAmong: f.splitAmong.filter(p => p !== name),
    }));
  };

  const toggleSplitPerson = (name) => {
    setForm(f => ({
      ...f,
      splitAmong: f.splitAmong.includes(name)
        ? f.splitAmong.filter(p => p !== name)
        : [...f.splitAmong, name],
    }));
  };

  const addExpense = () => {
    const amount = parseFloat(form.amount);
    if (!form.desc.trim() || isNaN(amount) || amount <= 0 || !form.paidBy || form.splitAmong.length === 0) return;
    setExpenses(prev => [...prev, { id: Date.now(), desc: form.desc.trim(), amount, paidBy: form.paidBy, splitAmong: [...form.splitAmong] }]);
    setForm(f => ({ ...f, desc: '', amount: '', splitAmong: [...people] }));
  };

  const removeExpense = (id) => setExpenses(prev => prev.filter(e => e.id !== id));

  const transactions = settle(people, expenses);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

  const resetAll = () => {
    setStep(0); setTripName(''); setNameInput(''); setPeople([]);
    setExpenses([]); setForm({ desc: '', amount: '', paidBy: '', splitAmong: [] }); setSettled(false);
  };

  return (
    <div className="sw-app">
      <header className="sw-header">
        <button className="sw-back" onClick={onBack}>← Back</button>
        <div className="sw-header-center">
          <span className="sw-logo">💸</span>
          <div>
            <div className="sw-title">SplitWise</div>
            {tripName && <div className="sw-trip-name">{tripName}</div>}
          </div>
        </div>
        <button className="sw-new-btn" onClick={resetAll}>New Trip</button>
      </header>

      <div className="sw-steps">
        {STEPS.map((s, idx) => (
          <button
            key={s}
            className={`sw-step-btn ${step === idx ? 'active' : ''} ${idx < step ? 'done' : ''}`}
            onClick={() => idx <= step && setStep(idx)}
          >
            <span className="sw-step-num">{idx < step ? '✓' : idx + 1}</span>
            {s}
          </button>
        ))}
      </div>

      <div className="sw-body">

        {/* Step 0: People */}
        {step === 0 && (
          <div className="sw-section">
            <div className="sw-section-title">Who went on the trip?</div>
            <div className="sw-form-row">
              <input
                className="sw-input"
                placeholder="Trip name (optional)"
                value={tripName}
                onChange={e => setTripName(e.target.value)}
              />
            </div>
            <div className="sw-form-row sw-inline">
              <input
                className="sw-input"
                placeholder="Add a person's name"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPerson()}
              />
              <button className="sw-btn-primary" onClick={addPerson}>Add</button>
            </div>
            <div className="sw-chips">
              {people.map(name => (
                <div key={name} className="sw-chip">
                  <span className="sw-chip-avatar">{name[0].toUpperCase()}</span>
                  {name}
                  <button className="sw-chip-remove" onClick={() => removePerson(name)}>×</button>
                </div>
              ))}
            </div>
            {people.length >= 2 && (
              <button className="sw-btn-primary sw-next" onClick={() => setStep(1)}>
                Continue with {people.length} people →
              </button>
            )}
            {people.length === 1 && (
              <p className="sw-hint">Add at least one more person to continue.</p>
            )}
          </div>
        )}

        {/* Step 1: Expenses */}
        {step === 1 && (
          <div className="sw-section">
            <div className="sw-section-title">Log expenses</div>
            <div className="sw-expense-form">
              <div className="sw-form-row">
                <label className="sw-label">Description</label>
                <input className="sw-input" placeholder="e.g. Petrol, Lunch, Hotel" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} />
              </div>
              <div className="sw-form-row-2">
                <div>
                  <label className="sw-label">Amount (₹)</label>
                  <input className="sw-input" type="number" placeholder="0" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="sw-label">Paid by</label>
                  <select className="sw-select" value={form.paidBy} onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))}>
                    {people.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="sw-form-row">
                <label className="sw-label">Split among</label>
                <div className="sw-check-group">
                  {people.map(p => (
                    <label key={p} className="sw-check-label">
                      <input type="checkbox" checked={form.splitAmong.includes(p)} onChange={() => toggleSplitPerson(p)} />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
              <button className="sw-btn-primary" onClick={addExpense}>+ Add Expense</button>
            </div>

            {expenses.length > 0 && (
              <div className="sw-expense-list">
                <div className="sw-list-title">Expenses ({expenses.length})</div>
                {expenses.map(exp => (
                  <div key={exp.id} className="sw-expense-row">
                    <div className="sw-exp-info">
                      <div className="sw-exp-desc">{exp.desc}</div>
                      <div className="sw-exp-meta">{exp.paidBy} paid · split {exp.splitAmong.length === people.length ? 'equally' : `among ${exp.splitAmong.join(', ')}`}</div>
                    </div>
                    <div className="sw-exp-right">
                      <span className="sw-exp-amount">₹{exp.amount.toFixed(2)}</span>
                      <button className="sw-remove-btn" onClick={() => removeExpense(exp.id)}>×</button>
                    </div>
                  </div>
                ))}
                <div className="sw-total-row">
                  <span>Total spent</span>
                  <span className="sw-total-amt">₹{totalSpent.toFixed(2)}</span>
                </div>
              </div>
            )}

            {expenses.length > 0 && (
              <button className="sw-btn-primary sw-next" onClick={() => { setStep(2); setSettled(false); }}>
                View Settlement →
              </button>
            )}
          </div>
        )}

        {/* Step 2: Settlement */}
        {step === 2 && (
          <div className="sw-section">
            <div className="sw-section-title">Settlement</div>
            <div className="sw-summary-bar">
              <div className="sw-summary-item">
                <span className="sw-summary-val">{people.length}</span>
                <span className="sw-summary-key">People</span>
              </div>
              <div className="sw-summary-item">
                <span className="sw-summary-val">{expenses.length}</span>
                <span className="sw-summary-key">Expenses</span>
              </div>
              <div className="sw-summary-item">
                <span className="sw-summary-val">₹{totalSpent.toFixed(0)}</span>
                <span className="sw-summary-key">Total</span>
              </div>
              <div className="sw-summary-item">
                <span className="sw-summary-val">₹{(totalSpent / people.length).toFixed(0)}</span>
                <span className="sw-summary-key">Per person</span>
              </div>
            </div>

            <div className="sw-breakdown">
              <div className="sw-breakdown-title">What each person paid</div>
              {people.map(p => {
                const paid = expenses.filter(e => e.paidBy === p).reduce((s, e) => s + e.amount, 0);
                const owed = expenses.reduce((s, e) => e.splitAmong.includes(p) ? s + e.amount / e.splitAmong.length : s, 0);
                const net = paid - owed;
                return (
                  <div key={p} className="sw-breakdown-row">
                    <span className="sw-breakdown-avatar">{p[0].toUpperCase()}</span>
                    <span className="sw-breakdown-name">{p}</span>
                    <span className="sw-breakdown-paid">paid ₹{paid.toFixed(0)}</span>
                    <span className={`sw-breakdown-net ${net > 0.01 ? 'positive' : net < -0.01 ? 'negative' : 'zero'}`}>
                      {net > 0.01 ? `gets back ₹${net.toFixed(0)}` : net < -0.01 ? `owes ₹${Math.abs(net).toFixed(0)}` : 'settled'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="sw-transactions">
              <div className="sw-transactions-title">Who pays whom</div>
              {transactions.length === 0 ? (
                <div className="sw-all-clear">Everyone is settled up!</div>
              ) : (
                transactions.map((t, i) => (
                  <div key={i} className={`sw-txn ${settled ? 'settled' : ''}`}>
                    <span className="sw-txn-from">{t.from}</span>
                    <span className="sw-txn-arrow">pays</span>
                    <span className="sw-txn-to">{t.to}</span>
                    <span className="sw-txn-amount">₹{t.amount.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="sw-settle-actions">
              <button className="sw-btn-secondary" onClick={() => setStep(1)}>← Edit Expenses</button>
              {transactions.length > 0 && (
                <button className="sw-btn-primary" onClick={() => setSettled(true)} disabled={settled}>
                  {settled ? 'All Settled!' : 'Mark All Settled'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
