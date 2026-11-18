// Moves data between the phone and Supabase.
// - push: uploads rows that changed on the phone (tracked in Pending)
// - pull: downloads rows that changed on the server since the last pull (other devices)
// Conflicts: a change still waiting on this phone wins; otherwise the server copy wins.

import { supabase } from './supabase';
import type { AppState, Pot, Settings, Transaction } from './types';
import { DEFAULT_SETTINGS, type Pending } from './store';

interface PotRow {
  user_id: string; id: string; name: string; emoji: string; planned: number; carry: number;
  keywords: string[]; sort: number; deleted: boolean; updated_at?: string;
}
interface TxRow {
  user_id: string; id: string; type: Transaction['type']; amount: number; pot_id: string | null; note: string;
  said: string | null; date: string; source: Transaction['source']; created_at: string; deleted: boolean; updated_at?: string;
}
interface ProfileRow {
  id: string; settings: Partial<Settings>; onboarded: boolean; last_period_start: string | null; updated_at?: string;
}

const potToRow = (uid: string, p: Pot, sort: number): PotRow => ({
  user_id: uid, id: p.id, name: p.name.slice(0, 60) || 'Pot', emoji: p.emoji, planned: Math.max(0, Math.round(p.planned)),
  carry: Math.max(0, Math.round(p.carry)), keywords: p.keywords.slice(0, 100), sort, deleted: false,
});
const rowToPot = (r: PotRow): Pot => ({
  id: r.id, name: r.name, emoji: r.emoji, planned: Number(r.planned), carry: Number(r.carry), keywords: r.keywords ?? [],
});
const txToRow = (uid: string, t: Transaction): TxRow => ({
  user_id: uid, id: t.id, type: t.type, amount: Math.round(t.amount), pot_id: t.potId ?? null, note: (t.note || '').slice(0, 200),
  said: t.said ? t.said.slice(0, 500) : null, date: t.date, source: t.source, created_at: t.createdAt, deleted: false,
});
const rowToTx = (r: TxRow): Transaction => ({
  id: r.id, type: r.type, amount: Number(r.amount), potId: r.pot_id ?? undefined, note: r.note, said: r.said ?? undefined,
  date: r.date, createdAt: r.created_at, source: r.source,
});

/** Uploads everything listed in `pending`. Returns the ids that were sent so they can be cleared. */
export async function push(uid: string, state: AppState, pending: Pending): Promise<Pending> {
  const sent: Pending = { profile: false, pots: [], txs: [] };

  if (pending.profile) {
    const { error } = await supabase.from('profiles').upsert({
      id: uid, settings: state.settings, onboarded: state.onboarded, last_period_start: state.lastPeriodStart ?? null,
    });
    if (error) throw error;
    sent.profile = true;
  }

  if (pending.pots.length) {
    const ids = new Set(pending.pots);
    const live = state.pots.map((p, i) => [p, i] as const).filter(([p]) => ids.has(p.id));
    const gone = pending.pots.filter((id) => !state.pots.some((p) => p.id === id));
    if (live.length) {
      const { error } = await supabase.from('pots').upsert(live.map(([p, i]) => potToRow(uid, p, i)));
      if (error) throw error;
    }
    if (gone.length) {
      const { error } = await supabase.from('pots').update({ deleted: true }).eq('user_id', uid).in('id', gone);
      if (error) throw error;
    }
    sent.pots = pending.pots;
  }

  if (pending.txs.length) {
    const ids = new Set(pending.txs);
    const live = state.transactions.filter((t) => ids.has(t.id));
    const gone = pending.txs.filter((id) => !state.transactions.some((t) => t.id === id));
    for (let i = 0; i < live.length; i += 500) {
      const { error } = await supabase.from('transactions').upsert(live.slice(i, i + 500).map((t) => txToRow(uid, t)));
      if (error) throw error;
    }
    if (gone.length) {
      const { error } = await supabase.from('transactions').update({ deleted: true }).eq('user_id', uid).in('id', gone);
      if (error) throw error;
    }
    sent.txs = pending.txs;
  }
  return sent;
}

export interface PullResult {
  profile: ProfileRow | null;
  pots: PotRow[];
  txs: TxRow[];
  newest?: string;
}

/** Downloads rows changed on the server since `since` (everything when `since` is empty). */
export async function pull(uid: string, since?: string): Promise<PullResult> {
  const sinceFilter = <T extends { gt: (c: string, v: string) => T }>(q: T) => (since ? q.gt('updated_at', since) : q);
  const [profileRes, potsRes, txRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    sinceFilter(supabase.from('pots').select('*').eq('user_id', uid)),
    sinceFilter(supabase.from('transactions').select('*').eq('user_id', uid).order('updated_at', { ascending: true }).limit(10000)),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (potsRes.error) throw potsRes.error;
  if (txRes.error) throw txRes.error;
  const pots = (potsRes.data ?? []) as PotRow[];
  const txs = (txRes.data ?? []) as TxRow[];
  const stamps = [...pots, ...txs].map((r) => r.updated_at ?? '').filter(Boolean);
  const profile = profileRes.data as ProfileRow | null;
  if (profile?.updated_at && (!since || profile.updated_at > since)) stamps.push(profile.updated_at);
  const newest = stamps.sort().at(-1);
  return { profile, pots, txs, newest };
}

/** Applies downloaded rows to the phone's state, keeping anything still waiting to upload. */
export function applyPull(state: AppState, r: PullResult, pending: Pending): AppState {
  let next = state;
  if (r.profile && r.profile.onboarded && !pending.profile) {
    next = {
      ...next,
      settings: { ...DEFAULT_SETTINGS, ...next.settings, ...r.profile.settings },
      onboarded: true,
      lastPeriodStart: r.profile.last_period_start ?? next.lastPeriodStart,
    };
  }
  if (r.pots.length) {
    const keep = new Set(pending.pots);
    const byId = new Map(next.pots.map((p) => [p.id, p]));
    const order = new Map<string, number>();
    next.pots.forEach((p, i) => order.set(p.id, i));
    for (const row of r.pots) {
      if (keep.has(row.id)) continue;
      if (row.deleted) byId.delete(row.id);
      else {
        byId.set(row.id, rowToPot(row));
        order.set(row.id, row.sort);
      }
    }
    next = { ...next, pots: [...byId.values()].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)) };
  }
  if (r.txs.length) {
    const keep = new Set(pending.txs);
    const byId = new Map(next.transactions.map((t) => [t.id, t]));
    for (const row of r.txs) {
      if (keep.has(row.id)) continue;
      if (row.deleted) byId.delete(row.id);
      else byId.set(row.id, rowToTx(row));
    }
    next = { ...next, transactions: [...byId.values()] };
  }
  return next;
}

export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
}
