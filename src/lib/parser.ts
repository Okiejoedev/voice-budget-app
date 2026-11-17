// The local (offline, free) understanding engine.
// Turns "I chop 1500 for mama put" into { intent: 'expense', items: [{ amount: 1500, potId: 'feeding' }] }.
// Claude (via /api/parse) is used as a smarter fallback when this engine is unsure.

import type { Intent, ParseResult, ParsedItem, Pot } from './types';
import {
  EDIT_LAST_WORDS, EXPENSE_WORDS, INCOME_WORDS, PLAN_WORDS, QUESTION_WORDS, SAVINGS_WORDS, UNDO_WORDS,
} from './dictionary';
import { findAmounts, findDate, stripSeparators, wordsToDigits, type FoundAmount } from './money';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const reCache = new Map<string, RegExp>();
function wordRe(phrase: string): RegExp {
  let re = reCache.get(phrase);
  if (!re) {
    re = new RegExp(`(^|[^a-z0-9])${escapeRe(phrase).replace(/\s+/g, '\\s+')}(?=$|[^a-z0-9])`, 'i');
    reCache.set(phrase, re);
  }
  return re;
}

export function hasAny(text: string, phrases: string[]): boolean {
  return phrases.some((p) => wordRe(p).test(text));
}

export function normalise(input: string): string {
  let t = input.toLowerCase();
  t = t.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  t = t.replace(/\bna(i)?ra\b/g, 'naira');
  t = stripSeparators(t);
  t = wordsToDigits(t);
  t = t.replace(/(\d)\s*k\s*(\d)/g, '$1.$2k'); // "1k5" -> "1.5k"
  return t;
}

interface PotMatch { potId: string; keyword: string; index: number }

/** Every pot keyword (and pot name) found in the text, with its position. */
export function findPotMatches(text: string, pots: Pot[]): PotMatch[] {
  const matches: PotMatch[] = [];
  for (const pot of pots) {
    const words = new Set<string>([...pot.keywords.map((k) => k.toLowerCase()), pot.name.toLowerCase(), pot.id]);
    // also match each significant word of a custom pot name ("Light & Power" -> "light", "power")
    pot.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3).forEach((w) => words.add(w));
    for (const w of words) {
      if (!w) continue;
      const m = wordRe(w).exec(text);
      if (m) matches.push({ potId: pot.id, keyword: w, index: m.index + m[1].length });
    }
  }
  return matches;
}

function bestPot(matches: PotMatch[]): PotMatch | undefined {
  // Longer keywords are more specific ("mama put" beats "put"; "school fees" beats "fees").
  return [...matches].sort((a, b) => b.keyword.length - a.keyword.length || a.index - b.index)[0];
}

const FILLER = new Set([
  'i', 'don', 'dey', 'go', 'for', 'the', 'my', 'on', 'a', 'an', 'to', 'of', 'in', 'at', 'just', 'naira', 'and', 'with', 'today',
  'spent', 'spend', 'buy', 'bought', 'pay', 'paid', 'use', 'used', 'am', 'e', 'na', 'this', 'that', 'some', 'small', 'abeg',
  'put', 'it', 'is', 'was', 'me', 'we', 'una', 'make', 'yesterday', 'morning', 'night', 'last', 'also', 'then', 'plus',
]);

function noteFrom(context: string, amount: FoundAmount | undefined, potKeyword?: string): string {
  let t = context;
  if (amount) t = t.replace(amount.raw, ' ');
  t = t.replace(/[₦]|\d+(\.\d+)?\s*(k|m|thousand|million)?\b/gi, ' ');
  const keep = new Set((potKeyword ?? '').split(/\s+/).filter(Boolean)); // never cut words of the matched phrase ("mama put")
  const words = t.split(/[^a-z'-]+/i).filter((w) => w && (keep.has(w.toLowerCase()) || !FILLER.has(w.toLowerCase())));
  const note = words.slice(0, 5).join(' ');
  return note || potKeyword || '';
}

function splitClauses(text: string): string[] {
  return text
    .split(/,|;|\band\b|\bthen\b|\bplus\b|\balso\b|\.(?!\d)|\bwith\b(?=\s+\d)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

interface Chunk { context: string; amount: FoundAmount }

/** Breaks the sentence into one chunk per amount, keeping the words around each amount as its context. */
function chunkByAmount(text: string): Chunk[] {
  const clauses = splitClauses(text);
  const chunks: Chunk[] = [];
  let pending = ''; // words from clauses without an amount ("I chop rice and beans 1500")
  for (const clause of clauses) {
    let amounts = findAmounts(clause);
    if (amounts.length > 1) {
      // drop small quantities like "2 bread" when a real price is also present
      const priced = amounts.filter((a) => a.hasScale || a.value >= 50);
      if (priced.length) amounts = priced;
    }
    if (amounts.length === 0) {
      pending = `${pending} ${clause}`.trim();
      continue;
    }
    if (amounts.length === 1) {
      chunks.push({ context: `${pending} ${clause}`.trim(), amount: amounts[0] });
      pending = '';
      continue;
    }
    // several amounts in one clause. People either name the thing first ("keke 800 data 2k")
    // or the amount first ("800 for keke 2k for data"): check which, then split to match.
    const amountFirst = !/[a-z]{3,}/.test(clause.slice(0, amounts[0].start).replace(/\b(i|don|spend|spent|pay|paid|buy|bought|use|used)\b/g, ''));
    amounts.forEach((a, i) => {
      const ctx = amountFirst
        ? clause.slice(a.start, i === amounts.length - 1 ? clause.length : amounts[i + 1].start)
        : clause.slice(i === 0 ? 0 : amounts[i - 1].end, i === amounts.length - 1 ? clause.length : a.end);
      chunks.push({ context: (i === 0 ? `${pending} ${ctx}` : ctx).trim(), amount: a });
    });
    pending = '';
  }
  if (pending && chunks.length) {
    chunks[chunks.length - 1].context += ` ${pending}`;
  }
  return chunks;
}

const WITHDRAW_WORDS = ['comot', 'withdraw', 'withdrew', 'take from', 'took from', 'remove', 'collect from', 'borrow from', 'use from', 'break', 'broke', 'out of', 'from my savings', 'from savings'];
const EXPENSE_VERBS = ['spent', 'spend', 'bought', 'buy', 'paid', 'pay', 'chop', 'chopped', 'ate', 'enter', 'entered', 'took', 'cost', 'don use', 'i use', 'i used'];
const SOFT_PLAN = ['put', 'keep', 'reserve', 'mark', 'i want', 'i wan', 'make e be', 'set'];

function detectIntent(t: string, amountCount: number): { intent: Intent; explicit: boolean } {
  if (hasAny(t, UNDO_WORDS) && amountCount === 0) return { intent: 'undo', explicit: true };
  if (hasAny(t, EDIT_LAST_WORDS) && amountCount === 1 && !hasAny(t, INCOME_WORDS)) return { intent: 'edit_last', explicit: true };
  const looksLikeQuestion = t.trim().endsWith('?') || hasAny(t, QUESTION_WORDS);
  if (looksLikeQuestion && (amountCount === 0 || t.trim().endsWith('?'))) return { intent: 'question', explicit: true };
  if (hasAny(t, SAVINGS_WORDS)) {
    if (hasAny(t, WITHDRAW_WORDS)) return { intent: 'vault_out', explicit: true };
    return { intent: 'vault_in', explicit: true };
  }
  if (hasAny(t, PLAN_WORDS)) return { intent: 'plan', explicit: true };
  if (hasAny(t, INCOME_WORDS)) return { intent: 'income', explicit: true };
  if (hasAny(t, SOFT_PLAN) && /\bfor\b/.test(t) && !hasAny(t, EXPENSE_VERBS)) return { intent: 'plan', explicit: false };
  if (amountCount > 0) return { intent: 'expense', explicit: hasAny(t, EXPENSE_WORDS) };
  return { intent: 'unknown', explicit: false };
}

export function parseLocal(input: string, pots: Pot[], today = new Date()): ParseResult {
  const original = input.trim();
  const t = normalise(original);
  const allAmounts = findAmounts(t);
  const { intent, explicit } = detectIntent(t, allAmounts.length);
  const date = findDate(t, today);
  const warnings: string[] = [];
  const base: ParseResult = { intent, items: [], confidence: 0, warnings, original, via: 'local' };

  if (intent === 'unknown') {
    return { ...base, confidence: 0.1 };
  }

  if (intent === 'undo') return { ...base, confidence: 0.9 };

  if (intent === 'edit_last') {
    return { ...base, items: [{ amount: allAmounts[0].value, note: '', date }], confidence: 0.8 };
  }

  if (intent === 'question') {
    const pot = bestPot(findPotMatches(t, pots));
    const spentQ = /\b(spend|spent|use|used|chop|pay|paid)\b/.test(t) && !/\bremain|left\b/.test(t);
    const range = /\btoday\b/.test(t) ? 'today' : /\bweek\b/.test(t) ? 'week' : 'period';
    return {
      ...base,
      confidence: 0.85,
      question: { potId: pot?.potId, kind: spentQ ? 'spent' : pot ? 'remaining' : 'summary', range },
    };
  }

  if (intent === 'income' || intent === 'vault_in' || intent === 'vault_out') {
    // money in/out of savings or income is usually one amount; if several, add them up
    if (allAmounts.length === 0) return { ...base, confidence: 0.3, warnings: ['I no hear the amount. Abeg talk am again.'] };
    let amount = allAmounts.reduce((s, a) => s + a.value, 0);
    const a0 = allAmounts[0];
    if (intent === 'income' && allAmounts.length === 1 && !a0.hasScale && a0.value < 1000) {
      amount = a0.value * 1000;
      warnings.push(`I took "${a0.value}" as ${amount.toLocaleString('en-NG')} naira. Fix am if e no correct.`);
    }
    const note = intent === 'income'
      ? (/(salary|don land|pay ?day)/.test(t) ? 'Salary' : noteFrom(t, allAmounts.length === 1 ? a0 : undefined) || 'Income')
      : intent === 'vault_in' ? noteFrom(t, allAmounts.length === 1 ? a0 : undefined, 'savings') || 'Saved' : ''; // a withdrawal needs the user's own reason
    return {
      ...base,
      items: [{ amount, note: capitalise(note), date }],
      confidence: explicit ? 0.9 : 0.7,
    };
  }

  // expense or plan: one item per amount, each matched to a pot
  const chunks = chunkByAmount(t);
  const items: ParsedItem[] = [];
  let matched = 0;
  for (const c of chunks) {
    const ctx = c.context;
    const pm = bestPot(findPotMatches(ctx, pots));
    if (pm) matched++;
    items.push({
      amount: c.amount.value,
      potId: pm?.potId ?? (intent === 'expense' ? 'other' : undefined),
      note: capitalise(noteFrom(ctx, c.amount, pm?.keyword)),
      date,
    });
  }
  if (items.length === 0) return { ...base, confidence: 0.2, warnings: ['I no hear the amount. Abeg talk am again.'] };
  const unmatched = items.length - matched;
  if (unmatched > 0) warnings.push(intent === 'plan'
    ? 'Some amounts no get pot. Choose the pot before you save.'
    : 'I no sure of the category for some items. I put them for Other; change am if you want.');
  const share = matched / items.length;
  const confidence = Math.min(0.95, 0.45 + (explicit ? 0.2 : 0.1) + share * 0.35);
  return { ...base, items, confidence, warnings };
}

function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
