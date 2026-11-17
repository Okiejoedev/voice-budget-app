// App state, saved on the phone (localStorage). Use Settings → Backup to export a copy.

import { useCallback, useEffect, useState } from 'react';
import type { AppState, Settings } from './types';
import { DEFAULT_POTS } from './dictionary';
import { applyNewPeriod } from './engine';

const KEY = 'voice-budget-state-v1';

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  periodMode: 'payday',
  paydayDay: 25,
  leftoverRule: 'rollover',
  replyLang: 'pidgin',
  aiMode: 'auto',
  speechLang: 'en-NG',
  talkBack: false,
};

export function freshState(): AppState {
  return {
    version: 1,
    onboarded: false,
    settings: { ...DEFAULT_SETTINGS },
    pots: DEFAULT_POTS.map((p) => ({ ...p, keywords: [...p.keywords] })),
    transactions: [],
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1) return freshState();
    return { ...freshState(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
  } catch {
    return freshState();
  }
}

function saveState(s: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage full or blocked (private mode); the app still works for this visit
  }
}

export function validateImport(data: unknown): AppState | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<AppState>;
  if (d.version !== 1 || !Array.isArray(d.pots) || !Array.isArray(d.transactions) || !d.settings) return null;
  return { ...freshState(), ...(d as AppState), settings: { ...DEFAULT_SETTINGS, ...d.settings } };
}

export function useAppState() {
  const [state, setStateRaw] = useState<AppState>(() => applyNewPeriod(loadState()));

  useEffect(() => saveState(state), [state]);

  // check for a new budget period when the app comes back to the foreground
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setStateRaw((s) => applyNewPeriod(s));
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const update = useCallback((fn: (s: AppState) => AppState) => setStateRaw((s) => fn(s)), []);
  return [state, update] as const;
}
