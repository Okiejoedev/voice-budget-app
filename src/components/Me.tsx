import { useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppState, Settings } from '../lib/types';
import { validateImport } from '../lib/store';
import { toISODate } from '../lib/money';
import type { SyncStatus } from '../lib/cloud';
import { Avatar } from './Avatar';
import { GoogleLogo } from './icons';
import { STATUS_TEXT } from './Home';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  user: User | null;
  status: SyncStatus;
  onGoogle: () => void;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onStartOver: () => void;
}

export function Me({ state, update, user, status, onGoogle, onSignOut, onDeleteAccount, onStartOver }: Props) {
  const s = state.settings;
  const set = (patch: Partial<Settings>) => update((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
  const fileRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState<string | null>(null);

  const exportData = () => {
    const { owner: _owner, ...data } = state;
    void _owner;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `voice-budget-${toISODate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const data = validateImport(JSON.parse(await file.text()));
      if (!data) { alert('That file is not a Voice Budget backup.'); return; }
      if (confirm('Replace your budget with this backup? Your current entries will be replaced.')) {
        update((cur) => ({ ...data, owner: cur.owner }));
      }
    } catch {
      alert('Could not read that file.');
    }
  };

  const signOut = async () => {
    setWorking('signout');
    try { await onSignOut(); } finally { setWorking(null); }
  };

  const del = async () => {
    if (!confirm('Delete your account and every entry in it? This cannot be undone.')) return;
    if (prompt('Type DELETE to confirm') !== 'DELETE') return;
    setWorking('delete');
    try { await onDeleteAccount(); } catch { alert('Could not delete your account. Check your connection and try again.'); } finally { setWorking(null); }
  };

  return (
    <div className="me">
      <h1 className="page-title">Me</h1>

      {user ? (
        <div className="me-head">
          <Avatar user={user} name={s.name} large />
          <div>
            <div className="nm">{s.name || (user.user_metadata?.full_name as string) || 'You'}</div>
            <div className="small muted">{user.email}</div>
            <div className="sync-line"><span className={`sync-dot ${status}`} /> {STATUS_TEXT[status]}</div>
          </div>
        </div>
      ) : (
        <div className="save-card">
          <h2 style={{ margin: 0 }}>Keep your money safe in an account</h2>
          <p>Right now everything is saved on this phone only. Sign in to back it up and use it on any device. What you've logged so far comes with you.</p>
          <button className="btn google block" onClick={onGoogle}><GoogleLogo /> Continue with Google</button>
        </div>
      )}

      <section className="card">
        <h2>Budget month</h2>
        <div className="seg" style={{ marginBottom: 14 }}>
          <button className={s.periodMode === 'payday' ? 'on' : ''} onClick={() => set({ periodMode: 'payday' })}>On payday</button>
          <button className={s.periodMode === 'calendar' ? 'on' : ''} onClick={() => set({ periodMode: 'calendar' })}>1st of the month</button>
        </div>
        {s.periodMode === 'payday' && (
          <label className="field">
            <span className="label">Payday</span>
            <select value={s.paydayDay} onChange={(e) => set({ paydayDay: Number(e.target.value) })}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Day {d} of the month</option>)}
            </select>
          </label>
        )}
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="label">Money left in pots at month end</span>
          <select value={s.leftoverRule} onChange={(e) => set({ leftoverRule: e.target.value as Settings['leftoverRule'] })}>
            <option value="rollover">Stays in the same pot next month</option>
            <option value="sweep">Goes into my Kolo savings</option>
          </select>
        </label>
      </section>

      <section className="card">
        <h2>Voice and language</h2>
        <label className="field">
          <span className="label">Your name</span>
          <input value={s.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">The app replies in</span>
          <select value={s.replyLang} onChange={(e) => set({ replyLang: e.target.value as Settings['replyLang'] })}>
            <option value="pidgin">Pidgin</option>
            <option value="english">English</option>
          </select>
        </label>
        <label className="field">
          <span className="label">Voice accent</span>
          <select value={s.speechLang} onChange={(e) => set({ speechLang: e.target.value })}>
            <option value="en-NG">Nigerian English (best for Pidgin)</option>
            <option value="en-GB">British English</option>
            <option value="en-US">American English</option>
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={s.talkBack} onChange={(e) => set({ talkBack: e.target.checked })} /> Read replies out loud</label>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <button className="list-btn" onClick={exportData}>Download a copy <span className="faint">.json</span></button>
        <button className="list-btn" onClick={() => fileRef.current?.click()}>Restore from a copy</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        <a className="list-btn" href={`${import.meta.env.BASE_URL}privacy.html`} style={{ textDecoration: 'none', color: 'inherit' }}>Privacy notice <span className="faint">↗</span></a>
      </section>

      <section className="card">
        {user ? (
          <>
            <button className="list-btn" onClick={signOut} disabled={!!working}>{working === 'signout' ? 'Signing out…' : 'Sign out'}</button>
            <button className="list-btn red" onClick={del} disabled={!!working}>{working === 'delete' ? 'Deleting…' : 'Delete my account'}</button>
          </>
        ) : (
          <button className="list-btn red" onClick={() => confirm('Clear everything on this phone and start again?') && onStartOver()}>Clear this phone and start over</button>
        )}
      </section>

      <p className="center tiny faint" style={{ marginTop: 10 }}>Voice Budget 0.2</p>
    </div>
  );
}
