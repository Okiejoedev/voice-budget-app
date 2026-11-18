import { useState } from 'react';
import type { AppState, Pot } from '../lib/types';
import { AmountInput } from './AmountInput';
import { formatNaira } from '../lib/money';
import { summary, uid } from '../lib/engine';

interface Props { state: AppState; update: (fn: (s: AppState) => AppState) => void }

const EMOJIS = ['🧾', '🎓', '💼', '🐶', '🚗', '📱', '🎁', '💊', '🛠️', '✈️', '👶', '📚', '💡', '🏋️'];

export function PlanView({ state, update }: Props) {
  const sum = summary(state);
  const [open, setOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const setPot = (id: string, patch: Partial<Pot>) =>
    update((s) => ({ ...s, pots: s.pots.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  const addPot = () => {
    const name = newName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid().slice(0, 6);
    if (state.pots.some((p) => p.id === id)) return;
    update((s) => ({
      ...s,
      pots: [...s.pots.filter((p) => p.id !== 'other'), { id, name, emoji: EMOJIS[s.pots.length % EMOJIS.length], planned: 0, carry: 0, keywords: [name.toLowerCase()] }, ...s.pots.filter((p) => p.id === 'other')],
    }));
    setNewName('');
  };

  const removePot = (id: string) => {
    if (id === 'other') return;
    const used = state.transactions.some((t) => t.potId === id);
    if (!confirm(used ? 'This pot has spending recorded. Remove it? Old entries will move to Other.' : 'Remove this pot?')) return;
    update((s) => ({
      ...s,
      pots: s.pots.filter((p) => p.id !== id),
      transactions: s.transactions.map((t) => (t.potId === id ? { ...t, potId: 'other' } : t)),
    }));
  };

  return (
    <div className="plan">
      <h1 className="page-title">Plan</h1>
      <section className="card">
        <div className="total-row"><span>Income this month</span><b>{formatNaira(sum.income)}</b></div>
        <div className="total-row"><span>Planned for pots</span><b>{formatNaira(sum.planned)}</b></div>
        <div className="total-row"><span>Saved this month</span><b>{formatNaira(sum.savedThisPeriod)}</b></div>
        <div className={`total-row big ${sum.freeMoney < 0 ? 'neg' : 'pos'}`}>
          <span>{sum.freeMoney < 0 ? 'Planned more than you earned' : 'Free money with no job yet'}</span>
          <b>{formatNaira(sum.freeMoney)}</b>
        </div>
        {sum.income === 0 && <p className="muted small">Log your income ("salary don land 200k") to see what's free.</p>}
      </section>

      <div className="section-head" style={{ marginTop: 22 }}><h2>Monthly budget per pot</h2></div>
      <p className="muted small" style={{ marginBottom: 12 }}>Or just say “put 20k for data, 60k for transport and 60k for feeding”.</p>
      {state.pots.map((p) => (
        <div className="card pot-edit" key={p.id}>
          <div className="pot-row">
            <button className="pot-name" onClick={() => setOpen(open === p.id ? null : p.id)}>
              {p.emoji} {p.name} <span className="chev">{open === p.id ? '▴' : '▾'}</span>
            </button>
            <AmountInput value={p.planned} onChange={(n) => setPot(p.id, { planned: n })} ariaLabel={`${p.name} budget`} />
          </div>
          {p.carry > 0 && <small className="muted">+ {formatNaira(p.carry)} rolled over from last month</small>}
          {open === p.id && (
            <div className="pot-details">
              <label className="field">
                <span className="label">Name</span>
                <input value={p.name} onChange={(e) => setPot(p.id, { name: e.target.value })} />
              </label>
              <label className="field">
                <span className="label">Words that mean this pot</span>
                <textarea
                  rows={3}
                  defaultValue={p.keywords.join(', ')}
                  onBlur={(e) => setPot(p.id, { keywords: e.target.value.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean) })}
                />
                <span className="hint">Separate with commas. When you say one of these, the spend lands here.</span>
              </label>
              {p.carry > 0 && <button className="link" onClick={() => setPot(p.id, { carry: 0 })}>Clear rolled-over amount</button>}
              {p.id !== 'other' && <button className="btn danger small" onClick={() => removePot(p.id)}>Remove pot</button>}
            </div>
          )}
        </div>
      ))}

      <div className="card add-pot">
        <input value={newName} placeholder="New pot name (e.g. School fees)" onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPot()} />
        <button className="btn primary" onClick={addPot} disabled={!newName.trim()}>Add pot</button>
      </div>
    </div>
  );
}
