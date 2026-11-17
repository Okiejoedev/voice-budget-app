import { useEffect, useRef, useState } from 'react';
import type { AppState, Settings } from '../lib/types';
import { freshState, validateImport } from '../lib/store';
import { aiAvailable } from '../lib/understand';
import { toISODate } from '../lib/money';

interface Props { state: AppState; update: (fn: (s: AppState) => AppState) => void }

export function SettingsView({ state, update }: Props) {
  const s = state.settings;
  const set = (patch: Partial<Settings>) => update((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
  const [ai, setAi] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { aiAvailable().then(setAi); }, []);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `voice-budget-backup-${toISODate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const data = validateImport(JSON.parse(await file.text()));
      if (!data) { alert('That file is not a backup from this app.'); return; }
      if (confirm('Replace everything on this phone with this backup?')) update(() => data);
    } catch {
      alert('Could not read that file.');
    }
  };

  return (
    <div className="settings">
      <section className="card">
        <h2>You</h2>
        <label className="field"><span>Name</span><input value={s.name} onChange={(e) => set({ name: e.target.value })} /></label>
      </section>

      <section className="card">
        <h2>Budget month</h2>
        <div className="seg">
          <button className={s.periodMode === 'payday' ? 'on' : ''} onClick={() => set({ periodMode: 'payday' })}>From payday</button>
          <button className={s.periodMode === 'calendar' ? 'on' : ''} onClick={() => set({ periodMode: 'calendar' })}>Calendar month</button>
        </div>
        {s.periodMode === 'payday' && (
          <label className="field inline">
            <span>Payday: day</span>
            <select value={s.paydayDay} onChange={(e) => set({ paydayDay: Number(e.target.value) })}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        )}
        <label className="field">
          <span>At month end, money left in pots should…</span>
          <select value={s.leftoverRule} onChange={(e) => set({ leftoverRule: e.target.value as Settings['leftoverRule'] })}>
            <option value="rollover">Roll over into next month's pots</option>
            <option value="sweep">Go into my savings vault</option>
          </select>
        </label>
      </section>

      <section className="card">
        <h2>Voice & language</h2>
        <label className="field">
          <span>App replies in</span>
          <select value={s.replyLang} onChange={(e) => set({ replyLang: e.target.value as Settings['replyLang'] })}>
            <option value="pidgin">Pidgin</option>
            <option value="english">English</option>
          </select>
        </label>
        <label className="field">
          <span>Voice recognition accent</span>
          <select value={s.speechLang} onChange={(e) => set({ speechLang: e.target.value })}>
            <option value="en-NG">English (Nigeria) — best for Pidgin</option>
            <option value="en-GB">English (UK)</option>
            <option value="en-US">English (US)</option>
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={s.talkBack} onChange={(e) => set({ talkBack: e.target.checked })} /> Read replies out loud</label>
        <label className="check"><input type="checkbox" checked={s.aiMode === 'auto'} onChange={(e) => set({ aiMode: e.target.checked ? 'auto' : 'off' })} /> Use Claude AI when the app is unsure</label>
        <p className="muted small">
          AI status: {ai === null ? 'checking…' : ai ? '✅ connected' : '⚪ not connected. The built-in Naija parser is handling everything (works offline, free). Add an ANTHROPIC_API_KEY on Vercel to switch AI on.'}
        </p>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted small">Everything is stored only on this phone, in this browser. Back it up regularly; clearing browser data deletes it.</p>
        <div className="btn-row">
          <button onClick={exportData}>⬇️ Back up</button>
          <button onClick={() => fileRef.current?.click()}>⬆️ Restore</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        </div>
        <button className="danger small" onClick={() => confirm('Delete ALL data on this phone? This cannot be undone.') && update(() => freshState())}>Delete all data</button>
      </section>

      <p className="muted center small">Voice Budget · v0.1 · Built with Claude</p>
    </div>
  );
}
