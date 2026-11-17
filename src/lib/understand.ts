// Decides how to understand what the user said:
// 1. the local Naija parser (instant, free, offline)
// 2. Claude via /api/parse when the local parser is unsure and the server has an API key

import type { AppState, Intent, ParseResult, ParsedItem } from './types';
import { parseLocal } from './parser';
import { toISODate } from './money';

const INTENTS: Intent[] = ['expense', 'income', 'plan', 'vault_in', 'vault_out', 'question', 'undo', 'edit_last', 'unknown'];
let aiStatus: Promise<boolean> | null = null;
const API = `${import.meta.env.BASE_URL}api/parse`; // only exists on Vercel; on GitHub Pages the offline parser does everything

/** Checks once whether the /api/parse endpoint exists and has a key. */
export function aiAvailable(): Promise<boolean> {
  if (!aiStatus) {
    aiStatus = (async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(API, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) return false;
        const data = (await res.json()) as { ok?: boolean };
        return data.ok === true;
      } catch {
        return false;
      }
    })();
  }
  return aiStatus;
}

export async function understand(text: string, state: AppState, today = new Date()): Promise<ParseResult> {
  const local = parseLocal(text, state.pots, today);
  const unsure = local.intent === 'unknown' || local.confidence < 0.75;
  if (state.settings.aiMode === 'off' || !unsure) return local;
  if (!(await aiAvailable())) return local;
  try {
    const ai = await parseWithAI(text, state, today);
    return ai ?? local;
  } catch {
    return local;
  }
}

async function parseWithAI(text: string, state: AppState, today: Date): Promise<ParseResult | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: ctrl.signal,
    body: JSON.stringify({
      text,
      today: toISODate(today),
      pots: state.pots.map((p) => ({ id: p.id, name: p.name, keywords: p.keywords.slice(0, 12) })),
    }),
  });
  clearTimeout(timer);
  if (!res.ok) return null;
  return sanitise(await res.json(), text, state, today);
}

/** Never trust model output blindly: check every field before the app uses it. */
export function sanitise(raw: unknown, original: string, state: AppState, today: Date): ParseResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const intent = INTENTS.includes(r.intent as Intent) ? (r.intent as Intent) : 'unknown';
  const potIds = new Set(state.pots.map((p) => p.id));
  const todayISO = toISODate(today);
  const items: ParsedItem[] = Array.isArray(r.items)
    ? (r.items as Record<string, unknown>[])
        .map((it) => {
          const amount = Math.round(Number(it.amount));
          const potId = typeof it.potId === 'string' && potIds.has(it.potId) ? it.potId : intent === 'expense' ? 'other' : undefined;
          const date = typeof it.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.date) && it.date <= todayISO ? it.date : todayISO;
          return { amount, potId, note: String(it.note ?? '').slice(0, 60), date };
        })
        .filter((it) => Number.isFinite(it.amount) && it.amount > 0 && it.amount < 1e10)
    : [];
  const q = r.question as Record<string, unknown> | undefined;
  const question = intent === 'question'
    ? {
        potId: typeof q?.potId === 'string' && potIds.has(q.potId) ? q.potId : undefined,
        kind: (['remaining', 'spent', 'summary'].includes(q?.kind as string) ? q?.kind : 'summary') as 'remaining' | 'spent' | 'summary',
        range: (['today', 'week', 'period'].includes(q?.range as string) ? q?.range : 'period') as 'today' | 'week' | 'period',
      }
    : undefined;
  const warnings = Array.isArray(r.warnings) ? (r.warnings as unknown[]).map(String).slice(0, 3) : [];
  if (['expense', 'income', 'plan', 'vault_in', 'vault_out', 'edit_last'].includes(intent) && items.length === 0) return null;
  return { intent, items, question, warnings, confidence: 0.85, original, via: 'ai' };
}
