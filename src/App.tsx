import { useEffect, useMemo, useState } from 'react';
import type { AppState, ParseResult, Transaction } from './lib/types';
import { useAppState } from './lib/store';
import { useSpeech, speak } from './lib/speech';
import { understand } from './lib/understand';
import { answerQuestion, potAlert, potStatuses, savedReply, uid } from './lib/engine';
import { formatNaira } from './lib/money';
import { Onboarding } from './components/Onboarding';
import { Home } from './components/Home';
import { PlanView } from './components/PlanView';
import { History } from './components/History';
import { SettingsView } from './components/SettingsView';
import { ConfirmSheet } from './components/ConfirmSheet';

type Tab = 'home' | 'plan' | 'history' | 'settings';

export default function App() {
  const [state, update] = useAppState();
  const [tab, setTab] = useState<Tab>('home');
  const [pending, setPending] = useState<ParseResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [thinking, setThinking] = useState(false);
  const speech = useSpeech(state.settings.speechLang);
  const lang = state.settings.replyLang;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const lastTx = useMemo<Transaction | undefined>(
    () => [...state.transactions].filter((t) => t.source !== 'system').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [state.transactions],
  );

  const reply = (msg: string) => {
    setToast(msg);
    speak(msg, state.settings.talkBack);
  };

  const handleText = async (text: string, source: 'voice' | 'typed') => {
    if (!text.trim()) return;
    setThinking(true);
    try {
      const r = await understand(text, state);
      (r as ParseResult & { source?: string }).source = source;
      if (r.intent === 'question' && r.question) {
        reply(answerQuestion(r.question, state));
      } else if (r.intent === 'unknown' || (r.items.length === 0 && r.intent !== 'undo')) {
        reply(lang === 'pidgin'
          ? `I no understand "${text}". Try: "I chop 1500 for mama put" or "salary don land 200k".`
          : `I didn't catch that. Try: "I spent 1,500 on food" or "salary 200k".`);
      } else {
        setPending(r);
      }
    } finally {
      setThinking(false);
    }
  };

  const commit = (r: ParseResult) => {
    const source = ((r as ParseResult & { source?: string }).source ?? 'typed') as Transaction['source'];
    let next: AppState = state;
    let extra = '';

    switch (r.intent) {
      case 'expense':
      case 'income':
      case 'vault_in':
      case 'vault_out': {
        const base = Date.now();
        const txs: Transaction[] = r.items.map((it, i) => ({
          id: uid(), type: r.intent as Transaction['type'], amount: it.amount,
          potId: r.intent === 'expense' ? it.potId ?? 'other' : undefined,
          note: it.note, said: r.original, date: it.date, createdAt: new Date(base + i).toISOString(), source,
        }));
        next = { ...state, transactions: [...state.transactions, ...txs] };
        if (r.intent === 'expense') {
          const ids = new Set(txs.map((t) => t.potId));
          const statuses = potStatuses(next).filter((s) => ids.has(s.pot.id));
          const alerts = statuses.map((s) => potAlert(s, lang)).filter(Boolean);
          if (txs.length > 1) extra = `${txs.length} items, ${formatNaira(txs.reduce((a, t) => a + t.amount, 0))} total.`;
          if (alerts.length) extra = `${extra} ${alerts.join(' ')}`.trim();
          else if (statuses.length === 1 && statuses[0].remaining > 0) {
            const s = statuses[0];
            extra = lang === 'pidgin'
              ? `${s.pot.name}: ${formatNaira(s.remaining)} remain (~${formatNaira(s.perDay)}/day).`
              : `${s.pot.name}: ${formatNaira(s.remaining)} left (~${formatNaira(s.perDay)}/day).`;
          }
        }
        if (r.intent === 'income') {
          extra = lang === 'pidgin' ? 'Check Plan to share am into your pots.' : 'Open Plan to give it a job.';
        }
        break;
      }
      case 'plan': {
        const totals = new Map<string, number>();
        for (const it of r.items) if (it.potId) totals.set(it.potId, (totals.get(it.potId) ?? 0) + it.amount);
        next = { ...state, pots: state.pots.map((p) => (totals.has(p.id) ? { ...p, planned: totals.get(p.id)! } : p)) };
        break;
      }
      case 'undo':
        if (lastTx) next = { ...state, transactions: state.transactions.filter((t) => t.id !== lastTx.id) };
        break;
      case 'edit_last':
        if (lastTx && r.items[0]) next = { ...state, transactions: state.transactions.map((t) => (t.id === lastTx.id ? { ...t, amount: r.items[0].amount } : t)) };
        break;
    }
    update(() => next);
    setPending(null);
    reply(savedReply(r.intent, lang, extra));
  };

  if (!state.onboarded) {
    return <Onboarding state={state} onDone={(s) => update(() => s)} />;
  }

  const micLabel = speech.listening ? 'Listening… tap to stop' : thinking ? 'Thinking…' : 'Tap and talk';

  return (
    <div className="app">
      <main>
        {tab === 'home' && <Home state={state} onAsk={(t) => handleText(t, 'typed')} />}
        {tab === 'plan' && <PlanView state={state} update={update} />}
        {tab === 'history' && <History state={state} update={update} />}
        {tab === 'settings' && <SettingsView state={state} update={update} />}
      </main>

      {toast && <div className="toast" role="status" onClick={() => setToast(null)}>{toast}</div>}
      {speech.error && <div className="toast error" role="alert" onClick={speech.clearError}>{speech.error}</div>}

      <div className="voice-bar">
        {(speech.listening || speech.interim) && <div className="interim">{speech.interim || 'Talk now…'}</div>}
        <form
          className="input-row"
          onSubmit={(e) => {
            e.preventDefault();
            const t = typed;
            setTyped('');
            handleText(t, 'typed');
          }}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={speech.supported ? 'Type am, or tap the mic' : 'Type e.g. "chop 1500 mama put"'}
            aria-label="Type what you spent or earned"
          />
          {typed.trim() ? (
            <button type="submit" className="send" aria-label="Send">➤</button>
          ) : speech.supported ? (
            <button
              type="button"
              className={`mic ${speech.listening ? 'on' : ''}`}
              aria-label={micLabel}
              disabled={thinking}
              onClick={() => (speech.listening ? speech.stop() : speech.start((t) => handleText(t, 'voice')))}
            >
              {thinking ? '…' : speech.listening ? '■' : '🎙️'}
            </button>
          ) : null}
        </form>
        <nav className="tabs">
          {([['home', '🏠', 'Home'], ['plan', '🎯', 'Plan'], ['history', '📜', 'History'], ['settings', '⚙️', 'Settings']] as const).map(([id, icon, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              <span>{icon}</span><small>{label}</small>
            </button>
          ))}
        </nav>
      </div>

      {pending && (
        <ConfirmSheet
          key={pending.original + pending.intent}
          state={state}
          result={pending}
          lastTx={lastTx}
          onCancel={() => setPending(null)}
          onConfirm={commit}
        />
      )}
    </div>
  );
}
