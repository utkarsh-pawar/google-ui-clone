import React, { useState, useCallback } from 'react';
import './SplitWise.css';

const STORAGE_KEY = 'splitwise-trips';

function loadTrips() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveTrips(trips) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trips)); }
  catch {}
}

function encodeTrip(trip) {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(trip)))); }
  catch { return ''; }
}

function decodeTrip(str) {
  try { return JSON.parse(decodeURIComponent(escape(atob(str)))); }
  catch { return null; }
}

function newTrip(name = '') {
  return { id: Date.now().toString(), name, people: [], expenses: [], createdAt: new Date().toISOString() };
}

function settle(people, expenses) {
  const balance = {};
  people.forEach(p => (balance[p] = 0));
  expenses.forEach(({ paidBy, amount, splitAmong }) => {
    const share = amount / splitAmong.length;
    balance[paidBy] = (balance[paidBy] || 0) + amount;
    splitAmong.forEach(p => { balance[p] = (balance[p] || 0) - share; });
  });
  const creditors = [], debtors = [];
  Object.entries(balance).forEach(([name, amt]) => {
    const r = Math.round(amt * 100) / 100;
    if (r > 0.01) creditors.push({ name, amt: r });
    else if (r < -0.01) debtors.push({ name, amt: -r });
  });
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);
  const txns = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const amt = Math.min(creditors[i].amt, debtors[j].amt);
    txns.push({ from: debtors[j].name, to: creditors[i].name, amount: Math.round(amt * 100) / 100 });
    creditors[i].amt -= amt; debtors[j].amt -= amt;
    if (creditors[i].amt < 0.01) i++;
    if (debtors[j].amt < 0.01) j++;
  }
  return txns;
}

/* ─── Shared (read-only) view ─────────────────────────────────────────── */
function SharedView({ trip }) {
  const { name, people, expenses } = trip;
  const transactions = settle(people, expenses);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="sw-app">
      <header className="sw-header">
        <div className="sw-header-center">
          <span className="sw-logo">💸</span>
          <div>
            <div className="sw-title">SplitWise</div>
            {name && <div className="sw-trip-name">{name}</div>}
          </div>
        </div>
        <div className="sw-readonly-badge">Read-only</div>
      </header>

      <div className="sw-body">
        <div className="sw-section">
          <div className="sw-summary-bar">
            <div className="sw-summary-item"><span className="sw-summary-val">{people.length}</span><span className="sw-summary-key">People</span></div>
            <div className="sw-summary-item"><span className="sw-summary-val">{expenses.length}</span><span className="sw-summary-key">Expenses</span></div>
            <div className="sw-summary-item"><span className="sw-summary-val">₹{totalSpent.toFixed(0)}</span><span className="sw-summary-key">Total</span></div>
            <div className="sw-summary-item"><span className="sw-summary-val">₹{people.length ? (totalSpent / people.length).toFixed(0) : 0}</span><span className="sw-summary-key">Per person</span></div>
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
            {transactions.length === 0
              ? <div className="sw-all-clear">Everyone is settled up!</div>
              : transactions.map((t, i) => (
                <div key={i} className="sw-txn">
                  <span className="sw-txn-from">{t.from}</span>
                  <span className="sw-txn-arrow">pays</span>
                  <span className="sw-txn-to">{t.to}</span>
                  <span className="sw-txn-amount">₹{t.amount.toFixed(2)}</span>
                </div>
              ))
            }
          </div>

          {expenses.length > 0 && (
            <div className="sw-breakdown">
              <div className="sw-breakdown-title">All expenses</div>
              {expenses.map(exp => (
                <div key={exp.id} className="sw-expense-row">
                  <div className="sw-exp-info">
                    <div className="sw-exp-desc">{exp.desc}</div>
                    <div className="sw-exp-meta">{exp.paidBy} paid · split {exp.splitAmong.length === people.length ? 'equally' : `among ${exp.splitAmong.join(', ')}`}</div>
                  </div>
                  <span className="sw-exp-amount">₹{exp.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Trip editor (3-step) ────────────────────────────────────────────── */
const STEPS = ['People', 'Expenses', 'Settlement'];

function TripEditor({ trip: initialTrip, onSave, onBack }) {
  const [trip, setTrip] = useState(initialTrip);
  const [step, setStep] = useState(0);
  const [nameInput, setNameInput] = useState('');
  const [form, setForm] = useState({
    desc: '', amount: '',
    paidBy: initialTrip.people[0] || '',
    splitAmong: [...initialTrip.people],
  });
  const [copied, setCopied] = useState(false);
  const [settled, setSettled] = useState(false);

  const persist = useCallback((updated) => {
    setTrip(updated);
    onSave(updated);
  }, [onSave]);

  const setTripName = (name) => persist({ ...trip, name });

  const addPerson = () => {
    const name = nameInput.trim();
    if (!name || trip.people.includes(name)) return;
    const people = [...trip.people, name];
    setNameInput('');
    setForm(f => ({ ...f, paidBy: f.paidBy || name, splitAmong: people }));
    persist({ ...trip, people });
  };

  const removePerson = (name) => {
    const people = trip.people.filter(p => p !== name);
    setForm(f => ({
      ...f,
      paidBy: f.paidBy === name ? (people[0] || '') : f.paidBy,
      splitAmong: f.splitAmong.filter(p => p !== name),
    }));
    persist({ ...trip, people });
  };

  const addExpense = () => {
    const amount = parseFloat(form.amount);
    if (!form.desc.trim() || isNaN(amount) || amount <= 0 || !form.paidBy || form.splitAmong.length === 0) return;
    const expense = { id: Date.now(), desc: form.desc.trim(), amount, paidBy: form.paidBy, splitAmong: [...form.splitAmong] };
    setForm(f => ({ ...f, desc: '', amount: '', splitAmong: [...trip.people] }));
    persist({ ...trip, expenses: [...trip.expenses, expense] });
  };

  const removeExpense = (id) => persist({ ...trip, expenses: trip.expenses.filter(e => e.id !== id) });

  const toggleSplitPerson = (name) => {
    setForm(f => ({
      ...f,
      splitAmong: f.splitAmong.includes(name) ? f.splitAmong.filter(p => p !== name) : [...f.splitAmong, name],
    }));
  };

  const copyShareLink = () => {
    const encoded = encodeTrip(trip);
    const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const transactions = settle(trip.people, trip.expenses);
  const totalSpent = trip.expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="sw-app">
      <header className="sw-header">
        <button className="sw-back" onClick={onBack}>← Trips</button>
        <div className="sw-header-center">
          <span className="sw-logo">💸</span>
          <div>
            <div className="sw-title">SplitWise</div>
            {trip.name && <div className="sw-trip-name">{trip.name}</div>}
          </div>
        </div>
        <div style={{ width: 80 }} />
      </header>

      <div className="sw-steps">
        {STEPS.map((s, idx) => (
          <button key={s} className={`sw-step-btn ${step === idx ? 'active' : ''} ${idx < step ? 'done' : ''}`} onClick={() => idx <= step && setStep(idx)}>
            <span className="sw-step-num">{idx < step ? '✓' : idx + 1}</span>{s}
          </button>
        ))}
      </div>

      <div className="sw-body">

        {/* Step 0: People */}
        {step === 0 && (
          <div className="sw-section">
            <div className="sw-section-title">Who went on the trip?</div>
            <div className="sw-form-row">
              <input className="sw-input" placeholder="Trip name (e.g. Goa Trip)" value={trip.name} onChange={e => setTripName(e.target.value)} />
            </div>
            <div className="sw-form-row sw-inline">
              <input className="sw-input" placeholder="Add a person's name" value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPerson()} />
              <button className="sw-btn-primary" onClick={addPerson}>Add</button>
            </div>
            <div className="sw-chips">
              {trip.people.map(name => (
                <div key={name} className="sw-chip">
                  <span className="sw-chip-avatar">{name[0].toUpperCase()}</span>
                  {name}
                  <button className="sw-chip-remove" onClick={() => removePerson(name)}>×</button>
                </div>
              ))}
            </div>
            {trip.people.length >= 2
              ? <button className="sw-btn-primary sw-next" onClick={() => setStep(1)}>Continue with {trip.people.length} people →</button>
              : <p className="sw-hint">{trip.people.length === 0 ? 'Add people to get started.' : 'Add at least one more person to continue.'}</p>
            }
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
                    {trip.people.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="sw-form-row">
                <label className="sw-label">Split among</label>
                <div className="sw-check-group">
                  {trip.people.map(p => (
                    <label key={p} className="sw-check-label">
                      <input type="checkbox" checked={form.splitAmong.includes(p)} onChange={() => toggleSplitPerson(p)} />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
              <button className="sw-btn-primary" onClick={addExpense}>+ Add Expense</button>
            </div>

            {trip.expenses.length > 0 && (
              <div className="sw-expense-list">
                <div className="sw-list-title">Expenses ({trip.expenses.length})</div>
                {trip.expenses.map(exp => (
                  <div key={exp.id} className="sw-expense-row">
                    <div className="sw-exp-info">
                      <div className="sw-exp-desc">{exp.desc}</div>
                      <div className="sw-exp-meta">{exp.paidBy} paid · split {exp.splitAmong.length === trip.people.length ? 'equally' : `among ${exp.splitAmong.join(', ')}`}</div>
                    </div>
                    <div className="sw-exp-right">
                      <span className="sw-exp-amount">₹{exp.amount.toFixed(2)}</span>
                      <button className="sw-remove-btn" onClick={() => removeExpense(exp.id)}>×</button>
                    </div>
                  </div>
                ))}
                <div className="sw-total-row"><span>Total spent</span><span className="sw-total-amt">₹{totalSpent.toFixed(2)}</span></div>
              </div>
            )}

            {trip.expenses.length > 0 && (
              <button className="sw-btn-primary sw-next" onClick={() => { setStep(2); setSettled(false); }}>View Settlement →</button>
            )}
          </div>
        )}

        {/* Step 2: Settlement */}
        {step === 2 && (
          <div className="sw-section">
            <div className="sw-section-header-row">
              <div className="sw-section-title" style={{ margin: 0 }}>Settlement</div>
              <button className={`sw-share-btn ${copied ? 'copied' : ''}`} onClick={copyShareLink}>
                {copied ? '✓ Link copied!' : '🔗 Share link'}
              </button>
            </div>

            <div className="sw-summary-bar" style={{ marginTop: 20 }}>
              <div className="sw-summary-item"><span className="sw-summary-val">{trip.people.length}</span><span className="sw-summary-key">People</span></div>
              <div className="sw-summary-item"><span className="sw-summary-val">{trip.expenses.length}</span><span className="sw-summary-key">Expenses</span></div>
              <div className="sw-summary-item"><span className="sw-summary-val">₹{totalSpent.toFixed(0)}</span><span className="sw-summary-key">Total</span></div>
              <div className="sw-summary-item"><span className="sw-summary-val">₹{(totalSpent / trip.people.length).toFixed(0)}</span><span className="sw-summary-key">Per person</span></div>
            </div>

            <div className="sw-breakdown">
              <div className="sw-breakdown-title">What each person paid</div>
              {trip.people.map(p => {
                const paid = trip.expenses.filter(e => e.paidBy === p).reduce((s, e) => s + e.amount, 0);
                const owed = trip.expenses.reduce((s, e) => e.splitAmong.includes(p) ? s + e.amount / e.splitAmong.length : s, 0);
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
              {transactions.length === 0
                ? <div className="sw-all-clear">Everyone is settled up!</div>
                : transactions.map((t, i) => (
                  <div key={i} className={`sw-txn ${settled ? 'settled' : ''}`}>
                    <span className="sw-txn-from">{t.from}</span>
                    <span className="sw-txn-arrow">pays</span>
                    <span className="sw-txn-to">{t.to}</span>
                    <span className="sw-txn-amount">₹{t.amount.toFixed(2)}</span>
                  </div>
                ))
              }
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

/* ─── Trips home screen ───────────────────────────────────────────────── */
function TripHome({ trips, onOpen, onNew, onDelete, onBack }) {
  const [confirmDelete, setConfirmDelete] = useState(null);

  return (
    <div className="sw-app">
      <header className="sw-header">
        <button className="sw-back" onClick={onBack}>← Back</button>
        <div className="sw-header-center">
          <span className="sw-logo">💸</span>
          <div className="sw-title">SplitWise</div>
        </div>
        <button className="sw-btn-primary" onClick={onNew}>+ New Trip</button>
      </header>

      <div className="sw-body">
        {trips.length === 0 ? (
          <div className="sw-empty">
            <div className="sw-empty-icon">🧳</div>
            <div className="sw-empty-title">No trips yet</div>
            <div className="sw-empty-sub">Start a new trip to split expenses with friends.</div>
            <button className="sw-btn-primary" style={{ marginTop: 20 }} onClick={onNew}>+ New Trip</button>
          </div>
        ) : (
          <div className="sw-section" style={{ maxWidth: 640, margin: '0 auto' }}>
            <div className="sw-section-title">Your trips</div>
            <div className="sw-trip-list">
              {trips.map(trip => {
                const total = trip.expenses.reduce((s, e) => s + e.amount, 0);
                const date = new Date(trip.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                return (
                  <div key={trip.id} className="sw-trip-card" onClick={() => onOpen(trip)}>
                    <div className="sw-trip-icon">🧳</div>
                    <div className="sw-trip-info">
                      <div className="sw-trip-name-text">{trip.name || 'Unnamed trip'}</div>
                      <div className="sw-trip-meta">{trip.people.length} people · {trip.expenses.length} expenses · {date}</div>
                    </div>
                    <div className="sw-trip-right">
                      {total > 0 && <div className="sw-trip-total">₹{total.toFixed(0)}</div>}
                      <button
                        className="sw-remove-btn"
                        onClick={e => { e.stopPropagation(); setConfirmDelete(trip.id); }}
                      >×</button>
                    </div>
                    {confirmDelete === trip.id && (
                      <div className="sw-confirm-delete" onClick={e => e.stopPropagation()}>
                        <span>Delete this trip?</span>
                        <button className="sw-btn-danger" onClick={() => { onDelete(trip.id); setConfirmDelete(null); }}>Delete</button>
                        <button className="sw-btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Root ────────────────────────────────────────────────────────────── */
function getShareParam() {
  return new URLSearchParams(window.location.search).get('share');
}

export default function SplitWise({ onBack }) {
  const [sharedTrip] = useState(() => {
    const param = getShareParam();
    return param ? decodeTrip(param) : null;
  });
  const [view, setView] = useState(() => (getShareParam() ? 'readonly' : 'home'));
  const [trips, setTrips] = useState(loadTrips);
  const [activeTrip, setActiveTrip] = useState(null);

  const saveTrip = useCallback((trip) => {
    setTrips(prev => {
      const updated = prev.find(t => t.id === trip.id)
        ? prev.map(t => t.id === trip.id ? trip : t)
        : [trip, ...prev];
      saveTrips(updated);
      return updated;
    });
  }, []);

  const deleteTrip = useCallback((id) => {
    setTrips(prev => { const updated = prev.filter(t => t.id !== id); saveTrips(updated); return updated; });
  }, []);

  if (view === 'readonly') return <SharedView trip={sharedTrip} />;

  if (view === 'trip') return (
    <TripEditor
      trip={activeTrip}
      onSave={saveTrip}
      onBack={() => setView('home')}
    />
  );

  return (
    <TripHome
      trips={trips}
      onOpen={t => { setActiveTrip(t); setView('trip'); }}
      onNew={() => { setActiveTrip(newTrip()); setView('trip'); }}
      onDelete={deleteTrip}
      onBack={onBack}
    />
  );
}
