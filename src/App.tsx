import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, ParseResult, Transaction } from './lib/types';
import { useAppState } from './lib/store';
import { useCloud } from './lib/cloud';
import { useSpeech, speak } from './lib/speech';
import { understand } from './lib/understand';
import { answerQuestion, applyNewPeriod, potAlert, potStatuses, savedReply, uid } from './lib/engine';
import { formatNaira } from './lib/money';
import { Splash } from './components/Splash';
import { Welcome } from './components/Welcome';
import { Setup } from './components/Setup';
import { Home } from './components/Home';
import { PlanView } from './components/PlanView';
import { History } from './components/History';
import { Me } from './components/Me';
import { ConfirmSheet } from './components/ConfirmSheet';
import { IconHome, IconKeyboard, IconList, IconMe, IconMic, IconPlan, IconSend, IconStop } from './components/icons';

type Tab = 'home' | 'plan' | 'history' | 'me';
type Pending = ParseResult & { source?: Transaction['source'] };

export default function App() {
  const store = useAppState();
  const { state, update } = store;
  const cloud = useCloud(store);
  const [signingIn, setSigningIn] = useState(false);

  // a new budget month may have started since the app was last opened
  useEffect(() => {
    if (state.onboarded) update((s) => applyNewPeriod(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.onboarded]);

  const google = async () => {
    setSigningIn(true);
    await cloud.signInWithGoogle();
    setTimeout(() => setSigningIn(false), 4000); // the page normally leaves for Google before this
  };

  if (!cloud.authReady) return <Splash />;
  if (cloud.adopting) return <Splash message="Bringing in your money…" />;
  if (!cloud.session && !cloud.guestMode && !state.onboarded) {
    return <Welcome onGoogle={google} onGuest={() => cloud.setGuestMode(true)} error={cloud.authError} busy={signingIn} />;
  }
  if (!state.onboarded) {
    const suggested = ((cloud.user?.user_metadata?.full_name as string) || '').split(' ')[0];
    return (
      <Setup
        state={state}
        suggestedName={suggested}
        onDone={(s) => update(() => s)}
        onBack={cloud.session ? undefined : () => cloud.setGuestMode(false)}
      />
    );
  }
  return <Main store={store} cloud={cloud} onGoogle={google} />;
}

function Main({ store, cloud, onGoogle }: { store: ReturnType<typeof useAppState>; cloud: ReturnType<typeof useCloud>; onGoogle: () => void }) {
  const { state, update } = store;
  const [tab, setTab] = useState<Tab>('home');
  const [pending, setPending] = useState<Pending | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [thinking, setThinking] = useState(false);
  const speech = useSpeech(state.settings.speechLang);
  const lang = state.settings.replyLang;
  const typeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [tab]);
  useEffect(() => { if (typing) typeRef.current?.focus(); }, [typing]);

  const lastTx = useMemo<Transaction | undefined>(
    () => [...state.transactions].filter((t) => t.source !== 'system').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [state.transactions],
  );

  const reply = (text: string) => {
    setToast({ text });
    speak(text, state.settings.talkBack);
  };

  const handleText = async (text: string, source: 'voice' | 'typed') => {
    if (!text.trim()) return;
    setThinking(true);
    try {
      const r: Pending = { ...(await understand(text, state)), source };
      if (r.intent === 'question' && r.question) reply(answerQuestion(r.question, state));
      else if (r.intent === 'unknown' || (r.items.length === 0 && r.intent !== 'undo')) {
        reply(lang === 'pidgin'
          ? `I no catch "${text}". Try "I chop 1500 for mama put" or "salary don land 200k".`
          : `I didn't catch "${text}". Try "I spent 1,500 on food" or "salary 200k".`);
      } else setPending(r);
    } finally {
      setThinking(false);
    }
  };

  const commit = (r: Pending) => {
    const source = r.source ?? 'typed';
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
              ? `${s.pot.name}: ${formatNaira(s.remaining)} remain, about ${formatNaira(s.perDay)} a day.`
              : `${s.pot.name}: ${formatNaira(s.remaining)} left, about ${formatNaira(s.perDay)} a day.`;
          }
        }
        if (r.intent === 'income') extra = lang === 'pidgin' ? 'Open Plan to share am into your pots.' : 'Open Plan to give it a job.';
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

  const talk = () => {
    if (speech.listening) speech.stop();
    else speech.start((t) => handleText(t, 'voice'));
  };

  return (
    <div className="app">
      <main key={tab}>
        {tab === 'home' && <Home state={state} user={cloud.user} status={cloud.status} onAsk={(t) => handleText(t, 'typed')} onOpenMe={() => setTab('me')} />}
        {tab === 'plan' && <PlanView state={state} update={update} />}
        {tab === 'history' && <History state={state} update={update} />}
        {tab === 'me' && (
          <Me
            state={state}
            update={update}
            user={cloud.user}
            status={cloud.status}
            onGoogle={onGoogle}
            onSignOut={cloud.signOut}
            onDeleteAccount={cloud.deleteAccount}
            onStartOver={cloud.resetGuest}
          />
        )}
      </main>

      {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role="status" onClick={() => setToast(null)}>{toast.text}</div>}
      {speech.error && <div className="toast error" role="alert" onClick={speech.clearError}>{speech.error}</div>}

      <div className="voice-bar">
        {(speech.listening || speech.interim || thinking) && (
          <div className="interim" aria-live="polite">
            {thinking ? <span className="faint">Working it out…</span> : speech.interim || <span className="faint">Listening. Say what you spent or earned…</span>}
          </div>
        )}
        {typing || !speech.supported ? (
          <form
            className="type-row"
            onSubmit={(e) => {
              e.preventDefault();
              const t = typed;
              setTyped('');
              void handleText(t, 'typed');
            }}
          >
            {speech.supported && <button type="button" className="round" aria-label="Switch to voice" onClick={() => setTyping(false)}><IconMic /></button>}
            <input ref={typeRef} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="e.g. chop 1500 mama put" aria-label="Type what you spent or earned" />
            <button type="submit" className="send" aria-label="Send" disabled={!typed.trim()}><IconSend /></button>
          </form>
        ) : (
          <div className="talk-row">
            <button className={`talk ${speech.listening ? 'on' : ''}`} onClick={talk} disabled={thinking} aria-label={speech.listening ? 'Stop listening' : 'Tap and talk'}>
              {speech.listening ? <><IconStop /> Listening… tap to stop</> : <><IconMic /> Tap and talk</>}
            </button>
            <button className="round" aria-label="Type instead" onClick={() => setTyping(true)}><IconKeyboard /></button>
          </div>
        )}
        <nav className="tabs" aria-label="Main">
          {([['home', IconHome, 'Home'], ['plan', IconPlan, 'Plan'], ['history', IconList, 'History'], ['me', IconMe, 'Me']] as const).map(([id, Icon, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
              <Icon /><span>{label}</span>
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
          onConfirm={(r) => commit({ ...r, source: pending.source })}
        />
      )}
    </div>
  );
}
