import { useState } from 'react';
import type { AppState, Transaction } from '../lib/types';
import { formatNaira } from '../lib/money';
import { dateLabel } from '../lib/engine';
import { AmountInput } from './AmountInput';

interface Props { state: AppState; update: (fn: (s: AppState) => AppState) => void }

const TYPE_LABEL: Record<Transaction['type'], string> = {
  expense: 'Spent', income: 'Income', vault_in: 'Into Kolo', vault_out: 'From Kolo',
};

export function History({ state, update }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Transaction['type']>('all');
  const txs = [...state.transactions]
    .filter((t) => filter === 'all' || t.type === filter)
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);
  const pot = (id?: string) => state.pots.find((p) => p.id === id);

  const save = (t: Transaction) => update((s) => ({ ...s, transactions: s.transactions.map((x) => (x.id === t.id ? t : x)) }));
  const remove = (id: string) => {
    if (!confirm('Delete this entry?')) return;
    update((s) => ({ ...s, transactions: s.transactions.filter((x) => x.id !== id) }));
  };

  return (
    <div className="history">
      <h1 className="page-title">History</h1>
      <div className="seg">
        {(['all', 'expense', 'income', 'vault_in', 'vault_out'] as const).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : TYPE_LABEL[f]}</button>
        ))}
      </div>
      {txs.length === 0 && <div className="empty" style={{ marginTop: 14 }}><p className="muted">Nothing here yet. Tap the yellow button and say what you spent.</p></div>}
      {[...groups.entries()].map(([date, list]) => (
        <section key={date}>
          <h3 className="date-head">{dateLabel(date)}</h3>
          {list.map((t) => (
            <div className="tx" key={t.id}>
              {editing === t.id ? (
                <TxEditor t={t} state={state} onSave={(x) => { save(x); setEditing(null); }} onCancel={() => setEditing(null)} onDelete={() => remove(t.id)} />
              ) : (
                <button className="tx-row" onClick={() => setEditing(t.id)}>
                  <span className="tx-icon">{t.type === 'expense' ? pot(t.potId)?.emoji ?? '🧾' : t.type === 'income' ? '💰' : '🔒'}</span>
                  <span className="tx-main">
                    <span className="tx-note">{t.note || pot(t.potId)?.name || TYPE_LABEL[t.type]}</span>
                    <span className="tx-sub">{t.type === 'expense' ? pot(t.potId)?.name ?? 'Other' : TYPE_LABEL[t.type]}{t.said ? `, “${t.said}”` : ''}</span>
                  </span>
                  <span className={`tx-amt ${t.type === 'expense' || t.type === 'vault_out' ? 'out' : 'in'}`}>
                    {t.type === 'expense' || t.type === 'vault_out' ? '−' : '+'}{formatNaira(t.amount)}
                  </span>
                </button>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function TxEditor({ t, state, onSave, onCancel, onDelete }: { t: Transaction; state: AppState; onSave: (t: Transaction) => void; onCancel: () => void; onDelete: () => void }) {
  const [x, setX] = useState(t);
  return (
    <div className="tx-edit">
      <AmountInput value={x.amount} onChange={(n) => setX({ ...x, amount: n })} ariaLabel="Amount" />
      {x.type === 'expense' && (
        <select value={x.potId} onChange={(e) => setX({ ...x, potId: e.target.value })}>
          {state.pots.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
        </select>
      )}
      <input value={x.note} placeholder="Note" onChange={(e) => setX({ ...x, note: e.target.value })} />
      <input type="date" value={x.date} onChange={(e) => setX({ ...x, date: e.target.value || t.date })} />
      <div className="sheet-actions">
        <button className="btn danger" onClick={onDelete}>Delete</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={x.amount <= 0} onClick={() => onSave(x)}>Save</button>
      </div>
    </div>
  );
}
