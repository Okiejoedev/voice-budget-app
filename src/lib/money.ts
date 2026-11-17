// Amount handling: formatting naira, turning spoken numbers into digits,
// and pulling amounts like "2k", "1.5k", "₦2,500", "fifty thousand" out of text.

export function formatNaira(n: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(Math.round(n));
  const s = '₦' + abs.toLocaleString('en-NG');
  if (n < 0) return '-' + s;
  if (opts.sign && n > 0) return '+' + s;
  return s;
}

export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}₦${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}₦${trim(abs / 1_000)}K`;
  return `${sign}₦${Math.round(abs)}`;
}

function trim(x: number): string {
  return (Math.round(x * 10) / 10).toString();
}

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1_000_000, billion: 1_000_000_000 };

function isNumberWord(w: string): boolean {
  return w in UNITS || w in TENS || w in SCALES || w === 'point' || w === 'half';
}

/**
 * Converts runs of spoken number words into digits.
 * "two thousand five hundred" -> "2500", "fifty k" -> "50 k", "one point five k" -> "1.5 k",
 * "twenty five hundred" -> "2500", "half a million" -> "500000".
 */
export function wordsToDigits(input: string): string {
  const tokens = input.split(/(\s+)/); // keep whitespace tokens so we can rebuild
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const word = tokens[i].toLowerCase().replace(/[^a-z-]/g, '');
    const parts = word.split('-').filter(Boolean);
    const halfOk = !(parts.length === 1 && parts[0] === 'half') ||
      ['a', 'k', 'm', 'million', 'thousand', 'naira'].includes(nextWord(tokens, i));
    const startsRun =
      halfOk &&
      parts.length > 0 &&
      parts.every(isNumberWord) &&
      !(parts.length === 1 && (parts[0] === 'point' || parts[0] === 'hundred' || parts[0] === 'thousand' || parts[0] === 'million'));
    // "a thousand", "a hundred", "a million"
    const aScale = word === 'a' && nextWord(tokens, i) in SCALES;
    if (!startsRun && !aScale) {
      out.push(tokens[i]);
      i++;
      continue;
    }
    // collect the run
    const run: string[] = [];
    let j = i;
    let lastIncluded = i;
    while (j < tokens.length) {
      const t = tokens[j];
      if (/^\s+$/.test(t)) { j++; continue; }
      const w = t.toLowerCase().replace(/[^a-z-]/g, '');
      const ps = w.split('-').filter(Boolean);
      if (ps.length && ps.every(isNumberWord)) { run.push(...ps); lastIncluded = j; j++; continue; }
      if (w === 'a' && run.length > 0 && run[run.length - 1] === 'half' && nextWord(tokens, j) in SCALES) { lastIncluded = j; j++; continue; }
      if (w === 'a' && run.length === 0 && nextWord(tokens, j) in SCALES) { run.push('one'); lastIncluded = j; j++; continue; }
      if (w === 'and' && run.length > 0 && isNumberWord(nextWord(tokens, j))) { lastIncluded = j; j++; continue; }
      break;
    }
    // A lone "one" is usually a pronoun in Pidgin ("dat one", "which one"), not ₦1,
    // unless a money suffix follows ("one k", "one naira").
    if (run.length === 1 && run[0] === 'one' && !['k', 'm', 'naira', 'kobo'].includes(nextWord(tokens, lastIncluded))) {
      out.push(tokens[i]);
      i++;
      continue;
    }
    const value = runValue(run);
    const trailing = tokens[lastIncluded].match(/[^a-zA-Z-]+$/)?.[0] ?? '';
    out.push(value === null ? tokens.slice(i, lastIncluded + 1).join('') : String(value) + trailing);
    i = lastIncluded + 1;
  }
  return out.join('');
}

function nextWord(tokens: string[], i: number): string {
  for (let k = i + 1; k < tokens.length; k++) {
    if (!/^\s+$/.test(tokens[k])) return tokens[k].toLowerCase().replace(/[^a-z-]/g, '');
  }
  return '';
}

function runValue(run: string[]): number | null {
  if (run.length === 0) return null;
  let total = 0;
  let current = 0;
  let decimals = '';
  let inDecimal = false;
  let half = false;
  for (const w of run) {
    if (w === 'half') { half = true; continue; }
    if (w === 'point') { inDecimal = true; continue; }
    if (inDecimal && w in UNITS && UNITS[w] < 10) { decimals += String(UNITS[w]); continue; }
    if (w in UNITS) { current += UNITS[w]; continue; }
    if (w in TENS) { current += TENS[w]; continue; }
    if (w === 'hundred') {
      current = (current || 1) * 100;
      continue;
    }
    if (w in SCALES) {
      let base = current || 1;
      if (decimals) base = parseFloat(`${current}.${decimals}`);
      if (half && current === 0) base = 0.5;
      total += base * SCALES[w];
      current = 0;
      decimals = '';
      inDecimal = false;
      half = false;
      continue;
    }
  }
  let rest = current;
  if (decimals) rest = parseFloat(`${current}.${decimals}`);
  if (half && current === 0 && total === 0) rest = 0.5;
  else if (half) rest += 0.5;
  const v = total + rest;
  return Number.isFinite(v) ? v : null;
}

export interface FoundAmount {
  value: number;
  start: number;
  end: number;
  raw: string;
  hasScale: boolean; // "k", "thousand", "m", or "naira" was said, so the size is certain
}

const AMOUNT_RE = /(?:₦|(?<![a-z])n(?=\d)|ngn\s?)?(\d+(?:\.\d+)?)\s*(k|m|thousand|million|grand|bn|billion)?\b(\s*naira)?/gi;

/** Removes thousands separators: "2,500" -> "2500", "1,250,000" -> "1250000". */
export function stripSeparators(text: string): string {
  let prev = '';
  let t = text;
  while (prev !== t) {
    prev = t;
    t = t.replace(/(\d),(\d{3})(?!\d)/g, '$1$2');
  }
  return t;
}

export function findAmounts(text: string): FoundAmount[] {
  const found: FoundAmount[] = [];
  AMOUNT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AMOUNT_RE.exec(text))) {
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n)) continue;
    const suffix = (m[2] || '').toLowerCase();
    let mult = 1;
    if (suffix === 'k' || suffix === 'thousand' || suffix === 'grand') mult = 1000;
    else if (suffix === 'm' || suffix === 'million') mult = 1_000_000;
    else if (suffix === 'bn' || suffix === 'billion') mult = 1_000_000_000;
    const value = Math.round(n * mult);
    if (value <= 0) continue;
    const hasPrefix = /^(₦|n|ngn)/i.test(m[0]);
    found.push({
      value,
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0],
      hasScale: mult > 1 || !!m[3] || hasPrefix,
    });
  }
  return found;
}

// ---- Dates ----

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Finds a relative date in the sentence ("yesterday", "last friday"). Defaults to today. */
export function findDate(text: string, today: Date): string {
  const t = text.toLowerCase();
  if (/\bday before yesterday\b|\bnext tomorrow\b/.test(t)) return toISODate(addDays(today, -2));
  if (/\byesterday\b|\byesternight\b|\blast night\b/.test(t)) return toISODate(addDays(today, -1));
  for (let i = 0; i < 7; i++) {
    const re = new RegExp(`\\b(last |on |dis |this past )?${WEEKDAYS[i]}\\b`);
    if (re.test(t)) {
      const diff = (today.getDay() - i + 7) % 7 || 7;
      return toISODate(addDays(today, -diff));
    }
  }
  return toISODate(today);
}
