import { useState } from 'react';
import type { AppState, Pot } from '../lib/types';
import { AmountInput } from './AmountInput';
import { KoloArt, IconMic, IconStop } from './icons';
import { formatNaira, toISODate } from '../lib/money';
import { getPeriod, uid } from '../lib/engine';
import { parseLocal } from '../lib/parser';
import { useSpeech } from '../lib/speech';

interface Props {
  state: AppState;
  suggestedName?: string;
  onDone: (s: AppState) => void;
  onBack?: () => void; // leave setup (back to welcome) from the first step
}

const STEPS = 5;
const PAYDAYS = [1, 15, 20, 25, 26, 28, 30];

export function Setup({ state, suggestedName, onDone, onBack }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(state.settings.name || suggestedName || '');
  const [savings, setSavings] = useState(0);
  const [mode, setMode] = useState(state.settings.periodMode);
  const [payday, setPayday] = useState(state.settings.paydayDay);
  const [income, setIncome] = useState(0);
  const [pots, setPots] = useState<Pot[]>(state.pots);
  const [tryText, setTryText] = useState('');
  const speech = useSpeech(state.settings.speechLang);

  const total = pots.reduce((s, p) => s + p.planned, 0);
  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const back = () => (step === 0 ? onBack?.() : setStep((s) => s - 1));

  const finish = () => {
    const settings = { ...state.settings, name: name.trim(), periodMode: mode, paydayDay: payday };
    const now = new Date();
    const transactions = [...state.transactions];
    if (savings > 0) {
      transactions.push({ id: uid(), type: 'vault_in', amount: savings, note: 'Starting savings', date: toISODate(now), createdAt: now.toISOString(), source: 'system' });
    }
    if (income > 0) {
      transactions.push({ id: uid(), type: 'income', amount: income, note: 'Monthly income', date: toISODate(now), createdAt: new Date(now.getTime() + 1).toISOString(), source: 'manual' });
    }
    onDone({ ...state, onboarded: true, settings, pots, transactions, lastPeriodStart: getPeriod(settings).startISO });
  };

  const parsed = tryText ? parseLocal(tryText, pots) : null;
  const tryLine = parsed && parsed.items[0]
    ? `${parsed.intent === 'income' ? 'Income' : parsed.intent === 'expense' ? 'Spent' : 'Understood'}: ${formatNaira(parsed.items[0].amount)}${parsed.items[0].potId ? ` · ${pots.find((p) => p.id === parsed.items[0].potId)?.name}` : ''}`
    : null;

  return (
    <div className="setup">
      <div className="setup-head">
        <button className="back" onClick={back} aria-label="Back" style={{ visibility: step === 0 && !onBack ? 'hidden' : 'visible' }}>←</button>
        <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1}>
          <div style={{ width: `${((step + 1) / STEPS) * 100}%` }} />
        </div>
        <span className="count">{step + 1} of {STEPS}</span>
      </div>

      {step === 0 && (
        <div className="step" key="name">
          <h2>Wetin we go call you?</h2>
          <p className="why">So the app can greet you properly.</p>
          <label className="field">
            <span className="sr-only">Your name</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" onKeyDown={(e) => e.key === 'Enter' && name.trim() && next()} />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="step" key="kolo">
          <KoloArt />
          <h2>Your Kolo</h2>
          <p className="why">How much do you have saved right now? It stays apart from your spending money, and the app will ask for a reason before you take from it.</p>
          <AmountInput value={savings} onChange={setSavings} placeholder="e.g. 500k" ariaLabel="Current savings" autoFocus />
          <p className="small faint" style={{ marginTop: 10 }}>You can type “500k”. Leave it empty if you're starting from zero.</p>
        </div>
      )}

      {step === 2 && (
        <div className="step" key="month">
          <h2>When does your money month start?</h2>
          <p className="why">Budgets run from one payday to the next, or by calendar month if your income comes in at different times.</p>
          <div className="seg" style={{ marginBottom: 20 }}>
            <button className={mode === 'payday' ? 'on' : ''} onClick={() => setMode('payday')}>On payday</button>
            <button className={mode === 'calendar' ? 'on' : ''} onClick={() => setMode('calendar')}>1st of the month</button>
          </div>
          {mode === 'payday' && (
            <>
              <p className="label" style={{ fontWeight: 600, marginBottom: 10 }}>I get paid on the…</p>
              <div className="chips">
                {PAYDAYS.map((d) => (
                  <button key={d} className={`chip ${payday === d ? 'on' : ''}`} onClick={() => setPayday(d)}>{ordinal(d)}</button>
                ))}
                <select aria-label="Other payday" value={PAYDAYS.includes(payday) ? '' : payday} onChange={(e) => e.target.value && setPayday(Number(e.target.value))} style={{ width: 'auto', borderRadius: 999, padding: '9px 14px' }}>
                  <option value="">Other day</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).filter((d) => !PAYDAYS.includes(d)).map((d) => <option key={d} value={d}>{ordinal(d)}</option>)}
                </select>
              </div>
            </>
          )}
          <label className="field" style={{ marginTop: 24 }}>
            <span className="label">Monthly income <span className="faint">(optional)</span></span>
            <AmountInput value={income} onChange={setIncome} placeholder="e.g. 200k" ariaLabel="Monthly income" />
            <span className="hint">Logged as this month's income. Later, just say “salary don land”.</span>
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="step" key="pots">
          <h2>Share your money into pots</h2>
          <p className="why">How much each pot gets every month. Leave a pot at ₦0 if you don't need it.</p>
          <div className="pot-plan">
            {pots.map((p, i) => (
              <div className="pot-plan-row" key={p.id}>
                <span className="nm">{p.emoji} {p.name}</span>
                <AmountInput value={p.planned} ariaLabel={`${p.name} budget`} onChange={(n) => setPots(pots.map((x, j) => (j === i ? { ...x, planned: n } : x)))} />
              </div>
            ))}
          </div>
          <div className="plan-total">
            <span>Planned</span>
            <span>{formatNaira(total)}{income > 0 && <span className={total > income ? '' : 'faint'} style={{ color: total > income ? 'var(--signal)' : undefined, fontWeight: 600 }}> of {formatNaira(income)}</span>}</span>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="step" key="try">
          <h2>Now try am</h2>
          <p className="why">Tap the button and say this sentence. Nothing is saved; it's just practice.</p>
          <div className="try-box">
            <div className="say-this">“I chop 1,500 for mama put”</div>
            {speech.supported ? (
              <button
                className={`talk ${speech.listening ? 'on' : ''}`}
                style={{ width: '100%' }}
                onClick={() => (speech.listening ? speech.stop() : speech.start((t) => setTryText(t)))}
              >
                {speech.listening ? <><IconStop /> Listening…</> : <><IconMic /> Tap and talk</>}
              </button>
            ) : (
              <input placeholder="Type it here instead" value={tryText} onChange={(e) => setTryText(e.target.value)} />
            )}
            {speech.interim && <div className="small muted">{speech.interim}</div>}
            {speech.error && <div className="small" style={{ color: 'var(--signal)' }}>{speech.error}</div>}
            {tryText && (
              <div className="try-result">
                I heard “{tryText}”<br />{tryLine ?? 'Try saying the amount clearly, like “fifteen hundred”.'}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="setup-foot">
        {step < STEPS - 1 ? (
          <button className="btn primary block" onClick={next} disabled={step === 0 && !name.trim()}>Continue</button>
        ) : (
          <button className="btn primary block" onClick={finish}>Start using Voice Budget</button>
        )}
        {(step === 1 || step === 4) && <button className="btn ghost block" onClick={step === 4 ? finish : next}>Skip</button>}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
