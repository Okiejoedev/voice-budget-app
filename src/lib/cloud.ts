// Sign-in state + keeping the phone and Supabase in step.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { appUrl, supabase } from './supabase';
import { applyPull, deleteAccount as deleteAccountRemote, pull, push } from './sync';
import { freshState, hasPending, mergePending, type Pending, type useAppState } from './store';
import type { AppState } from './types';

export type SyncStatus = 'guest' | 'syncing' | 'synced' | 'offline' | 'error';

const MODE_KEY = 'voice-budget-mode'; // 'guest' once someone taps "Use without an account"
const EMPTY: Pending = { profile: false, pots: [], txs: [] };

type Store = ReturnType<typeof useAppState>;

export function useCloud(store: Store) {
  const { state, replace, pendingRef, setPending, pendingVersion } = store;
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [adopting, setAdopting] = useState(false); // first download after sign-in
  const [status, setStatus] = useState<SyncStatus>('guest');
  const [authError, setAuthError] = useState<string | null>(null);
  const [guestMode, setGuestModeState] = useState(() => localStorage.getItem(MODE_KEY) === 'guest');
  const stateRef = useRef(state);
  stateRef.current = state;
  const uid = session?.user.id ?? null;
  const busy = useRef(false);

  // ---- auth ----
  useEffect(() => {
    // Google sends people back with ?error=… when something is misconfigured or they cancel
    const params = new URLSearchParams(window.location.search + window.location.hash.replace('#', '&'));
    const err = params.get('error_description') || params.get('error');
    if (err) setAuthError(friendlyAuthError(err));

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
      if (window.location.search.includes('code=') || err) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: appUrl(), queryParams: { prompt: 'select_account' } },
    });
    if (error) setAuthError(friendlyAuthError(error.message));
  }, []);

  const setGuestMode = useCallback((on: boolean) => {
    if (on) localStorage.setItem(MODE_KEY, 'guest');
    else localStorage.removeItem(MODE_KEY);
    setGuestModeState(on);
  }, []);

  // ---- sync ----
  const flush = useCallback(async () => {
    if (!uid || busy.current) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    const snapshot = pendingRef.current;
    if (!hasPending(snapshot)) { setStatus('synced'); return; }
    busy.current = true;
    setStatus('syncing');
    // start a fresh list so changes made during the upload are kept for next time
    setPending((p) => ({ ...EMPTY, lastPulledAt: p.lastPulledAt }));
    try {
      await push(uid, stateRef.current, snapshot);
      setStatus(hasPending(pendingRef.current) ? 'syncing' : 'synced');
    } catch {
      setPending((p) => mergePending(p, snapshot));
      setStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      busy.current = false;
    }
    if (hasPending(pendingRef.current)) setTimeout(() => void flush(), 400);
  }, [uid, pendingRef, setPending]);

  const refresh = useCallback(async () => {
    if (!uid || !navigator.onLine) return;
    try {
      const r = await pull(uid, pendingRef.current.lastPulledAt);
      if (r.pots.length || r.txs.length || r.profile) replace((s) => applyPull(s, r, pendingRef.current));
      if (r.newest) setPending((p) => ({ ...p, lastPulledAt: r.newest }));
      await flush();
    } catch {
      setStatus(navigator.onLine ? 'error' : 'offline');
    }
  }, [uid, pendingRef, replace, setPending, flush]);

  // When someone signs in, bring this phone's data and their account together
  useEffect(() => {
    if (!authReady) return;
    if (!uid) { setStatus('guest'); return; }
    const local = stateRef.current;
    if (local.owner === uid) { void refresh(); return; }

    let cancelled = false;
    setAdopting(true);
    setStatus('syncing');
    (async () => {
      try {
        const r = await pull(uid);
        if (cancelled) return;
        const serverHasAccount = !!r.profile?.onboarded;
        let base: AppState = local.owner ? { ...freshState(), owner: uid } : { ...local, owner: uid };
        base = applyPull(base, r, EMPTY);
        replace(() => base);
        const serverTxIds = new Set(r.txs.map((t) => t.id));
        const localOnlyTxs = base.transactions.filter((t) => !serverTxIds.has(t.id)).map((t) => t.id);
        setPending(() => ({
          profile: !serverHasAccount && base.onboarded,
          pots: serverHasAccount ? [] : base.pots.map((p) => p.id),
          txs: localOnlyTxs,
          lastPulledAt: r.newest,
        }));
        setGuestMode(false);
      } catch {
        // offline at sign-in: keep working locally and attach the data to this account
        replace((s) => ({ ...s, owner: uid }));
        setPending((p) => ({ ...p, profile: true, pots: stateRef.current.pots.map((x) => x.id), txs: stateRef.current.transactions.map((t) => t.id) }));
        setStatus('offline');
      } finally {
        if (!cancelled) setAdopting(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, uid]);

  // upload shortly after each change
  useEffect(() => {
    if (!uid || adopting) return;
    const t = setTimeout(() => void flush(), 700);
    return () => clearTimeout(t);
  }, [pendingVersion, uid, adopting, flush]);

  // catch up when the network returns or the app comes back to the screen
  useEffect(() => {
    if (!uid) return;
    const onOnline = () => void refresh();
    const onOffline = () => setStatus('offline');
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [uid, refresh]);

  const signOut = useCallback(async () => {
    await flush().catch(() => {});
    await supabase.auth.signOut();
    replace(() => freshState());
    setPending(() => ({ ...EMPTY }));
    setGuestMode(false);
  }, [flush, replace, setPending, setGuestMode]);

  /** Leave guest mode and start over (data on this phone is cleared). */
  const resetGuest = useCallback(() => {
    replace(() => freshState());
    setPending(() => ({ ...EMPTY }));
    setGuestMode(false);
  }, [replace, setPending, setGuestMode]);

  const deleteAccount = useCallback(async () => {
    await deleteAccountRemote();
    await supabase.auth.signOut();
    replace(() => freshState());
    setPending(() => ({ ...EMPTY }));
    setGuestMode(false);
  }, [replace, setPending, setGuestMode]);

  return {
    session, user: session?.user ?? null, authReady, adopting, status, authError, guestMode,
    signInWithGoogle, setGuestMode, signOut, resetGuest, deleteAccount, refresh,
  };
}

function friendlyAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return 'Google sign-in isn\'t switched on yet. Try again in a few minutes, or continue without an account.';
  if (m.includes('access_denied') || m.includes('denied')) return 'Sign-in was cancelled. Tap "Continue with Google" to try again.';
  if (m.includes('network') || m.includes('fetch')) return 'No internet connection. Connect and try again, or continue without an account.';
  return `Sign-in didn't work: ${raw}`;
}
