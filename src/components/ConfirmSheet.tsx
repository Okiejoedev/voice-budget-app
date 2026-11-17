import { useState } from 'react';
import type { AppState, Intent, ParseResult, ParsedItem, Transaction } from '../lib/types';
import { AmountInput } from './AmountInput';
import { formatNaira, toISODate } from '../lib/money';
import { dateLabel } from '../lib/engine';

const EDITABLE: { id: Intent; label: string }[] = [
  { id: 'expense', label: 'Spent' },
  { id: 'income', label: 'Income' },
  { id: 'plan', label: 'Budget plan' },
  { id: 'vault_in', label: 'Save' },
  { id: 'vault_out', label: 'From savings' },
];

const TITLES: Partial<Record<Intent, string>> = {
  expense: 'Money spent',
  income: 'Money in',
  plan: 'Set your budget',
  vault_in: 'Add to savings',
  vault_out: 'Take from savings',
};

interface Props {
  state: AppState;
  result: ParseResult;
  lastTx?: Transaction;
  onConfirm: (r: ParseResult) => void;
  onCancel: () => void;
}

export function ConfirmSheet({ state, result, lastTx, onConfirm, onCancel }: Props) {
  const [r, setR] = useState<ParseResult>(result);
  const today = toISODate(new Date());
  const potName = (id?: string) => state.pots.find((p) => p.id === id);

  const setItem = (i: number, patch: Partial<ParsedItem>) =>
    setR({ ...r, items: r.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });

  // Undo and edit get a simple yes/no card
  if (r.intent === 'undo' || r.intent === 'edit_last') {
    return (
      <Sheet onCancel={onCancel}>
        <div className="heard">You said: “{r.original}”</div>
        {!lastTx && <p>Nothing to {r.intent === 'undo' ? 'delete' : 'change'} yet.</p>}
        {lastTx && (
          <>
            <h2>{r.intent === 'undo' ? 'Delete the last entry?' : 'Change the last entry?'}</h2>
            <div className="tx-preview">
              <b>{lastTx.type === 'expense' ? `${potName(lastTx.potId)?.emoji ?? ''} ${lastTx.note || potName(lastTx.potId)?.name}` : lastTx.note}</b>
              <span>{formatNaira(lastTx.amount)}{r.intent === 'edit_last' && r.items[0] ? ` → ${formatNaira(r.items[0].amount)}` : ''}</span>
            </div>
          </>
        )}
        <div className="sheet-actions">
          <button onClick={onCancel}>No</button>
          <button className={r.intent === 'undo' ? 'danger' : 'primary'} disabled={!lastTx} onClick={() => onConfirm(r)}>
            {r.intent === 'undo' ? 'Yes, delete' : 'Yes, change'}
          </button>
        </div>
      </Sheet>
    );
  }

  const needsPot = r.intent === 'expense' || r.intent === 'plan';
  const valid = r.items.length > 0 && r.items.every((it) => it.amount > 0 && (!needsPot || it.potId)) &&
    (r.intent !== 'vault_out' || r.items.every((it) => it.note.trim().length > 1));
  const total = r.items.reduce((s, it) => s + it.amount, 0);

  return (
    <Sheet onCancel={onCancel}>
      <div className="heard">You said: “{r.original}”{r.via === 'ai' && <span className="ai-badge">AI</span>}</div>
      <div className="type-switch">
        {EDITABLE.map((t) => (
          <button key={t.id} className={r.intent === t.id ? 'on' : ''} onClick={() => setR({ ...r, intent: t.id })}>{t.label}</button>
        ))}
      </div>
      <h2>{TITLES[r.intent] ?? 'Check this'}</h2>
      {r.warnings.map((w) => <div className="warning" key={w}>⚠️ {w}</div>)}
      {r.intent === 'vault_out' && <div className="warning">🔒 This is your savings. Write the reason you need it.</div>}

      <div className="items">
        {r.items.map((it, i) => (
          <div className="item" key={i}>
            <div className="item-row">
              <AmountInput value={it.amount} onChange={(n) => setItem(i, { amount: n })} ariaLabel="Amount" />
              {r.items.length > 1 && <button className="icon" aria-label="Remove item" onClick={() => setR({ ...r, items: r.items.filter((_, j) => j !== i) })}>✕</button>}
            </div>
            {needsPot && (
              <select value={it.potId ?? ''} onChange={(e) => setItem(i, { potId: e.target.value })} aria-label="Pot">
                <option value="" disabled>Choose pot…</option>
                {state.pots.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
              </select>
            )}
            {r.intent !== 'plan' && (
              <div className="item-row">
                <input
                  className="note"
                  value={it.note}
                  placeholder={r.intent === 'vault_out' ? 'Reason (required)' : 'Note'}
                  onChange={(e) => setItem(i, { note: e.target.value })}
                />
                <input type="date" value={it.date} max={today} onChange={(e) => setItem(i, { date: e.target.value || today })} aria-label="Date" />
              </div>
            )}
            {r.intent !== 'plan' && it.date !== today && <small className="muted">{dateLabel(it.date)}</small>}
          </div>
        ))}
        <button className="link" onClick={() => setR({ ...r, items: [...r.items, { amount: 0, potId: needsPot ? undefined : undefined, note: '', date: today }] })}>+ Add another</button>
      </div>

      {r.items.length > 1 && r.intent !== 'plan' && <div className="total-row"><span>Total</span><b>{formatNaira(total)}</b></div>}
      {r.intent === 'plan' && <p className="muted small">This sets each pot's monthly budget to the amount shown.</p>}

      <div className="sheet-actions">
        <button onClick={onCancel}>Cancel</button>
        <button className="primary" disabled={!valid} onClick={() => onConfirm(r)}>✓ Save</button>
      </div>
    </Sheet>
  );
}

function Sheet({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        {children}
      </div>
    </div>
  );
}
