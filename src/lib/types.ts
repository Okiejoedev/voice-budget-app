// Core data types for the app. Everything is stored in naira (whole numbers).

export type TxType = 'expense' | 'income' | 'vault_in' | 'vault_out';

export interface Pot {
  id: string;
  name: string;
  emoji: string;
  planned: number; // planned amount per budget period
  carry: number; // leftover rolled over from the previous period
  keywords: string[]; // the user's own words that should land in this pot
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  potId?: string; // expenses only
  note: string;
  said?: string; // the exact words spoken or typed, so mistakes can be traced
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp
  source: 'voice' | 'typed' | 'manual' | 'system';
}

export type PeriodMode = 'payday' | 'calendar';
export type LeftoverRule = 'rollover' | 'sweep';
export type ReplyLang = 'pidgin' | 'english';
export type AiMode = 'auto' | 'off';

export interface Settings {
  name: string;
  periodMode: PeriodMode;
  paydayDay: number; // 1–31, used when periodMode is 'payday'
  leftoverRule: LeftoverRule;
  replyLang: ReplyLang;
  aiMode: AiMode;
  speechLang: string; // BCP-47 tag for the browser recogniser
  talkBack: boolean; // read replies out loud
}

export interface AppState {
  version: 1;
  onboarded: boolean;
  settings: Settings;
  pots: Pot[];
  transactions: Transaction[];
  lastPeriodStart?: string; // used to detect when a new period begins
  owner?: string | null; // Supabase user id this data belongs to; null/undefined = guest on this phone
}

// ---- Parser output ----

export type Intent =
  | 'expense'
  | 'income'
  | 'plan'
  | 'vault_in'
  | 'vault_out'
  | 'question'
  | 'undo'
  | 'edit_last'
  | 'unknown';

export interface ParsedItem {
  amount: number;
  potId?: string;
  note: string;
  date: string;
}

export interface ParseResult {
  intent: Intent;
  items: ParsedItem[];
  confidence: number; // 0–1
  warnings: string[]; // things the user should double-check
  question?: { potId?: string; kind: 'remaining' | 'spent' | 'summary'; range: 'today' | 'week' | 'period' };
  original: string;
  via: 'local' | 'ai';
}
