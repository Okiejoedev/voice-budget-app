import { useState } from 'react';
import type { AppState } from '../lib/types';
import { AmountInput } from './AmountInput';
import { formatNaira, toISODate } from '../lib/money';
import { getPeriod, uid } from '../lib/engine';

interface Props { state: AppState; onDone: (s: AppState) => void }

export function Onboarding({ state, onDone }: Props) {
  const [name, setName] = useState(state.settings.name);
  const [savings, setSavings] = useState(0);
  const [mode, setMode] = useState(state.settings.periodMode);
  const [payday, setPayday] = useState(state.settings.paydayDay);
  const [pots, setPots] = useState(state.pots);
  const total = pots.reduce((s, p) => s + p.planned, 0);

  const finish = () => {
    const settings = { ...state.settings, name: name.trim(), periodMode: mode, paydayDay: payday };
    const transactions = [...state.transactions];
    if (savings > 0) {
      transactions.push({
        id: uid(), type: 'vault_in', amount: savings, note: 'Starting savings', date: toISODate(new Date()),
        createdAt: new Date().toISOString(), source: 'system',
      });
    }
    onDone({
      ...state,
      onboarded: true,
      settings,
      pots,
      transactions,
      lastPeriodStart: getPeriod(settings).startISO,
    });
  };

  return (
    <div className="onboarding">
      <div className="hero">
        <div className="logo">🎙️₦</div>
        <h1>Talk your money.<br />E go arrange am.</h1>
        <p>Tell me what you earn and spend, in English or Pidgin. I go keep your budget for you.</p>
      </div>

      <section className="card">
        <label className="field">
          <span>Wetin we go call you?</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </label>
        <label className="field">
          <span>How much you get for savings now?</span>
          <AmountInput value={savings} onChange={setSavings} placeholder="e.g. 500k" ariaLabel="Current savings" />
          <small>This stays in your savings vault. The app will warn you before you touch it.</small>
        </label>
      </section>

      <section className="card">
        <h2>Your budget month</h2>
        <div className="seg">
          <button className={mode === 'payday' ? 'on' : ''} onClick={() => setMode('payday')}>From payday</button>
          <button className={mode === 'calendar' ? 'on' : ''} onClick={() => setMode('calendar')}>Calendar month</button>
        </div>
        {mode === 'payday' && (
          <label className="field inline">
            <span>Payday is on day</span>
            <select value={payday} onChange={(e) => setPayday(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <span>of every month</span>
          </label>
        )}
      </section>

      <section className="card">
        <h2>Your pots for the month</h2>
        <p className="muted">How much you plan for each one. Leave as ₦0 if you don't need it. You can change this anytime, or just say "put 20k for data".</p>
        {pots.map((p, i) => (
          <div className="pot-row" key={p.id}>
            <span className="pot-name">{p.emoji} {p.name}</span>
            <AmountInput
              value={p.planned}
              ariaLabel={`${p.name} budget`}
              onChange={(n) => setPots(pots.map((x, j) => (j === i ? { ...x, planned: n } : x)))}
            />
          </div>
        ))}
        <div className="total-row"><span>Total planned</span><b>{formatNaira(total)}</b></div>
      </section>

      <button className="primary big" onClick={finish}>Start →</button>
      <p className="muted center small">Your data stays on this phone. Back it up from Settings.</p>
    </div>
  );
}
