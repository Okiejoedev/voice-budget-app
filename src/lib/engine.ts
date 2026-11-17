// Budget maths. The AI never does arithmetic: every total shown in the app comes from here.

import type { AppState, ParseResult, Pot, ReplyLang, Settings, Transaction } from './types';
import { addDays, formatNaira, parseISODate, toISODate } from './money';

export interface Period { start: Date; end: Date; startISO: string; endISO: string }

function clampDay(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

export function getPeriod(settings: Settings, today = new Date()): Period {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let start: Date;
  let end: Date;
  if (settings.periodMode === 'calendar') {
    start = new Date(t.getFullYear(), t.getMonth(), 1);
    end = new Date(t.getFullYear(), t.getMonth() + 1, 0);
  } else {
    const d = settings.paydayDay;
    const thisMonthPayday = clampDay(t.getFullYear(), t.getMonth(), d);
    start = t >= thisMonthPayday ? thisMonthPayday : clampDay(t.getFullYear(), t.getMonth() - 1, d);
    const next = clampDay(start.getFullYear(), start.getMonth() + 1, d);
    end = addDays(next, -1);
  }
  return { start, end, startISO: toISODate(start), endISO: toISODate(end) };
}

export function inPeriod(tx: Transaction, p: Period): boolean {
  return tx.date >= p.startISO && tx.date <= p.endISO;
}

export function daysLeft(p: Period, today = new Date()): number {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const ms = p.end.getTime() - t.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export interface PotStatus {
  pot: Pot;
  budget: number; // planned + carry
  spent: number;
  remaining: number;
  pct: number; // spent / budget (0–∞), 0 when budget is 0
  perDay: number; // safe to spend per day for the rest of the period
}

export function potStatuses(state: AppState, today = new Date()): PotStatus[] {
  const p = getPeriod(state.settings, today);
  const left = daysLeft(p, today);
  return state.pots.map((pot) => {
    const spent = state.transactions
      .filter((t) => t.type === 'expense' && t.potId === pot.id && inPeriod(t, p))
      .reduce((s, t) => s + t.amount, 0);
    const budget = pot.planned + pot.carry;
    const remaining = budget - spent;
    return {
      pot,
      budget,
      spent,
      remaining,
      pct: budget > 0 ? spent / budget : spent > 0 ? 1 : 0,
      perDay: Math.max(0, Math.floor(remaining / left)),
    };
  });
}

export interface Summary {
  period: Period;
  daysLeft: number;
  vault: number;
  income: number;
  planned: number;
  savedThisPeriod: number;
  freeMoney: number; // income not yet given a job (planned or saved)
  spent: number;
  remaining: number; // across all pots
  safeToday: number;
}

export function vaultBalance(state: AppState): number {
  return state.transactions.reduce((s, t) => (t.type === 'vault_in' ? s + t.amount : t.type === 'vault_out' ? s - t.amount : s), 0);
}

export function summary(state: AppState, today = new Date()): Summary {
  const period = getPeriod(state.settings, today);
  const left = daysLeft(period, today);
  const txs = state.transactions.filter((t) => inPeriod(t, period));
  const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const savedIn = txs.filter((t) => t.type === 'vault_in' && t.source !== 'system').reduce((s, t) => s + t.amount, 0);
  const savedOut = txs.filter((t) => t.type === 'vault_out').reduce((s, t) => s + t.amount, 0);
  const planned = state.pots.reduce((s, p) => s + p.planned, 0);
  const statuses = potStatuses(state, today);
  const spent = statuses.reduce((s, x) => s + x.spent, 0);
  const remaining = statuses.reduce((s, x) => s + Math.max(0, x.remaining), 0);
  return {
    period,
    daysLeft: left,
    vault: vaultBalance(state),
    income,
    planned,
    savedThisPeriod: savedIn - savedOut,
    freeMoney: income - planned - savedIn + savedOut,
    spent,
    remaining,
    safeToday: Math.floor(remaining / left),
  };
}

/**
 * When a new budget period starts, deal with last period's leftovers:
 * roll them into each pot, or sweep them into the savings vault.
 */
export function applyNewPeriod(state: AppState, today = new Date()): AppState {
  const current = getPeriod(state.settings, today);
  if (!state.lastPeriodStart) return { ...state, lastPeriodStart: current.startISO };
  if (state.lastPeriodStart >= current.startISO) return state;

  const prevDay = addDays(current.start, -1);
  const prevStatuses = potStatuses(state, prevDay);
  let pots = state.pots;
  const transactions = [...state.transactions];
  if (state.settings.leftoverRule === 'rollover') {
    pots = state.pots.map((pot) => {
      const st = prevStatuses.find((s) => s.pot.id === pot.id);
      return { ...pot, carry: Math.max(0, st?.remaining ?? 0) };
    });
  } else {
    const leftover = prevStatuses.reduce((s, x) => s + Math.max(0, x.remaining), 0);
    pots = state.pots.map((pot) => ({ ...pot, carry: 0 }));
    if (leftover > 0) {
      transactions.push({
        id: uid(), type: 'vault_in', amount: leftover, note: 'Leftover from last month', date: current.startISO,
        createdAt: new Date().toISOString(), source: 'system',
      });
    }
  }
  return { ...state, pots, transactions, lastPeriodStart: current.startISO };
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---- Words the app says back ----

const say = (lang: ReplyLang, pidgin: string, english: string) => (lang === 'pidgin' ? pidgin : english);

export function potAlert(st: PotStatus, lang: ReplyLang): string | null {
  const name = st.pot.name;
  if (st.budget <= 0) return say(lang, `${name} no get budget. Set am for Plan.`, `${name} has no budget yet. Set one in Plan.`);
  if (st.remaining < 0) return say(lang, `${name} don pass budget by ${formatNaira(-st.remaining)}. Take am easy o!`, `${name} is over budget by ${formatNaira(-st.remaining)}.`);
  if (st.pct >= 1) return say(lang, `${name} don finish. Na zero remain.`, `${name} is used up.`);
  if (st.pct >= 0.8) return say(lang, `${name} don reach ${Math.round(st.pct * 100)}%. Calm down small 😅`, `${name} is at ${Math.round(st.pct * 100)}%. Go easy.`);
  if (st.pct >= 0.5) return say(lang, `${name} don reach half.`, `${name} is at ${Math.round(st.pct * 100)}%.`);
  return null;
}

export function answerQuestion(q: NonNullable<ParseResult['question']>, state: AppState, today = new Date()): string {
  const lang = state.settings.replyLang;
  const sum = summary(state, today);
  const statuses = potStatuses(state, today);
  if (q.kind === 'spent') {
    const start = q.range === 'today' ? toISODate(today) : q.range === 'week' ? toISODate(addDays(today, -((today.getDay() + 6) % 7))) : sum.period.startISO;
    const txs = state.transactions.filter((t) => t.type === 'expense' && t.date >= start && t.date <= toISODate(today) && (!q.potId || t.potId === q.potId));
    const total = txs.reduce((s, t) => s + t.amount, 0);
    const what = q.potId ? state.pots.find((p) => p.id === q.potId)?.name ?? 'that' : say(lang, 'everything', 'everything');
    const when = q.range === 'today' ? say(lang, 'today', 'today') : q.range === 'week' ? say(lang, 'this week', 'this week') : say(lang, 'this month', 'this budget period');
    return say(lang, `You don spend ${formatNaira(total)} for ${what} ${when}.`, `You've spent ${formatNaira(total)} on ${what} ${when}.`);
  }
  if (q.kind === 'remaining' && q.potId) {
    const st = statuses.find((s) => s.pot.id === q.potId);
    if (st) {
      if (st.remaining <= 0) return say(lang, `${st.pot.name}: nothing remain. You don pass by ${formatNaira(-st.remaining)}.`, `${st.pot.name}: nothing left (over by ${formatNaira(-st.remaining)}).`);
      return say(lang,
        `${st.pot.name}: ${formatNaira(st.remaining)} remain for ${sum.daysLeft} days. Na about ${formatNaira(st.perDay)} per day.`,
        `${st.pot.name}: ${formatNaira(st.remaining)} left for ${sum.daysLeft} days, about ${formatNaira(st.perDay)} a day.`);
    }
  }
  return say(lang,
    `You get ${formatNaira(sum.remaining)} remain for your pots, ${sum.daysLeft} days to go. Today you fit spend about ${formatNaira(sum.safeToday)}. Savings: ${formatNaira(sum.vault)}.`,
    `You have ${formatNaira(sum.remaining)} left across your pots with ${sum.daysLeft} days to go. Safe to spend today: about ${formatNaira(sum.safeToday)}. Savings: ${formatNaira(sum.vault)}.`);
}

export function savedReply(kind: string, lang: ReplyLang, extra = ''): string {
  const map: Record<string, [string, string]> = {
    expense: ['I don record am.', 'Recorded.'],
    income: ['Money don enter! I don record am.', 'Income recorded.'],
    plan: ['Plan don set.', 'Plan updated.'],
    vault_in: ['Savings don increase. Well done!', 'Added to savings. Nice!'],
    vault_out: ['I don remove am from savings.', 'Taken from savings.'],
    undo: ['I don delete am.', 'Deleted.'],
    edit_last: ['I don change am.', 'Updated.'],
  };
  const [p, e] = map[kind] ?? ['Done.', 'Done.'];
  return `${say(lang, p, e)}${extra ? ' ' + extra : ''}`;
}

export function periodLabel(p: Period): string {
  const f = (d: Date) => d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  return `${f(p.start)} – ${f(p.end)}`;
}

export function dateLabel(iso: string, today = new Date()): string {
  const t = toISODate(today);
  if (iso === t) return 'Today';
  if (iso === toISODate(addDays(today, -1))) return 'Yesterday';
  return parseISODate(iso).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
}
