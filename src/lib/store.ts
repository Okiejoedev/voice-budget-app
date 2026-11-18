// App state lives on the phone first (so it works offline and feels instant)
// and is synced to Supabase when the person is signed in.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState, Settings } from './types';
import { DEFAULT_POTS } from './dictionary';

const KEY = 'voice-budget-state-v1';
const PENDING_KEY = 'voice-budget-pending-v1';

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

// ---- Changes waiting to be sent to the server ----

export interface Pending {
  profile: boolean;
  pots: string[];
  txs: string[];
  lastPulledAt?: string; // server time of the newest row we've seen
}

export function loadPending(): Pending {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null') as Pending | null;
    if (p && Array.isArray(p.pots) && Array.isArray(p.txs)) return p;
  } catch { /* ignore */ }
  return { profile: false, pots: [], txs: [] };
}

export function savePending(p: Pending): void {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

/** Works out which rows changed between two states, so only those are uploaded. */
export function diffChanges(prev: AppState, next: AppState): { profile: boolean; pots: string[]; txs: string[] } {
  const profile =
    JSON.stringify(prev.settings) !== JSON.stringify(next.settings) ||
    prev.onboarded !== next.onboarded ||
    prev.lastPeriodStart !== next.lastPeriodStart;
  const pots = changedIds(prev.pots, next.pots);
  // pot order is stored too, so a reorder marks every pot
  if (prev.pots.map((p) => p.id).join() !== next.pots.map((p) => p.id).join()) next.pots.forEach((p) => pots.add(p.id));
  return { profile, pots: [...pots], txs: [...changedIds(prev.transactions, next.transactions)] };
}

function changedIds<T extends { id: string }>(a: T[], b: T[]): Set<string> {
  const out = new Set<string>();
  if (a === b) return out;
  const before = new Map(a.map((x) => [x.id, x]));
  for (const x of b) {
    const old = before.get(x.id);
    if (!old || (old !== x && JSON.stringify(old) !== JSON.stringify(x))) out.add(x.id);
    before.delete(x.id);
  }
  for (const id of before.keys()) out.add(id); // removed
  return out;
}

export function mergePending(p: Pending, c: { profile: boolean; pots: string[]; txs: string[] }): Pending {
  return {
    ...p,
    profile: p.profile || c.profile,
    pots: [...new Set([...p.pots, ...c.pots])],
    txs: [...new Set([...p.txs, ...c.txs])],
  };
}

export function hasPending(p: Pending): boolean {
  return p.profile || p.pots.length > 0 || p.txs.length > 0;
}

/**
 * The app's state plus a record of what changed since the last upload.
 * `update` is the only way to change data, so every change is tracked for sync.
 */
export function useAppState() {
  const [state, setState] = useState<AppState>(loadState);
  const pendingRef = useRef<Pending>(loadPending());
  const [pendingVersion, setPendingVersion] = useState(0);

  useEffect(() => saveState(state), [state]);

  const update = useCallback((fn: (s: AppState) => AppState) => {
    setState((prev) => {
      const next = fn(prev);
      if (next !== prev && next.owner === prev.owner) {
        const c = diffChanges(prev, next);
        if (c.profile || c.pots.length || c.txs.length) {
          pendingRef.current = mergePending(pendingRef.current, c);
          savePending(pendingRef.current);
          queueMicrotask(() => setPendingVersion((v) => v + 1));
        }
      }
      return next;
    });
  }, []);

  /** Replace state without marking anything for upload (used when applying server data). */
  const replace = useCallback((fn: (s: AppState) => AppState) => setState(fn), []);

  const setPending = useCallback((fn: (p: Pending) => Pending) => {
    pendingRef.current = fn(pendingRef.current);
    savePending(pendingRef.current);
    setPendingVersion((v) => v + 1);
  }, []);

  return { state, update, replace, pendingRef, setPending, pendingVersion };
}
