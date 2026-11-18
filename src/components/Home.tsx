import type { AppState } from '../lib/types';
import { potStatuses, summary } from '../lib/engine';
import { formatNaira } from '../lib/money';
import type { User } from '@supabase/supabase-js';
import type { SyncStatus } from '../lib/cloud';
import { Avatar } from './Avatar';

interface Props {
  state: AppState;
  user: User | null;
  status: SyncStatus;
  onAsk: (text: string) => void;
  onOpenMe: () => void;
}

export function Home({ state, user, status, onAsk, onOpenMe }: Props) {
  const sum = summary(state);
  const statuses = potStatuses(state).filter((s) => s.budget > 0 || s.spent > 0);
  const name = state.settings.name;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const toPayday = state.settings.periodMode === 'payday' ? 'to payday' : 'to month end';
  const hasEntries = state.transactions.some((t) => t.source !== 'system');

  return (
    <div className="home">
      <div className="topbar">
        <h1>{greet}{name ? `, ${name}` : ''}</h1>
        <button className="who" onClick={onOpenMe} aria-label="Account and settings">
          <span className={`sync-dot ${status}`} title={STATUS_TEXT[status]} />
          <Avatar user={user} name={name} />
        </button>
      </div>

      <section className="safe" aria-label="Safe to spend today">
        <div className="label">Safe to spend today</div>
        <div className={`figure ${sum.safeToday <= 0 && sum.planned > 0 ? 'zero' : ''}`}>{formatNaira(sum.safeToday)}</div>
        <p className="line"><b>{formatNaira(sum.remaining)}</b> left in your pots, {sum.daysLeft} day{sum.daysLeft === 1 ? '' : 's'} {toPayday}.</p>
      </section>

      <div className="money-strip">
        <div className="kolo"><span className="k">Kolo savings</span><span className="v">{formatNaira(sum.vault)}</span></div>
        <div><span className="k">Income</span><span className="v">{formatNaira(sum.income)}</span></div>
        <div>
          <span className="k">{sum.income === 0 ? 'Free money' : sum.freeMoney < 0 ? 'Over-planned' : 'Free money'}</span>
          <span className={`v ${sum.freeMoney < 0 && sum.income > 0 ? 'neg' : ''}`}>{sum.income === 0 ? '—' : formatNaira(sum.freeMoney)}</span>
        </div>
      </div>

      <div className="section-head">
        <h2>Your pots</h2>
        <span className="small muted">{formatNaira(sum.spent)} spent</span>
      </div>
      {statuses.length === 0 ? (
        <div className="empty"><p className="muted">No pots have money yet. Say “put 20k for data and 60k for transport”, or open Plan.</p></div>
      ) : (
        <div className="pots">
          {statuses.map((s) => {
            const pct = Math.min(100, Math.round(s.pct * 100));
            const level = s.remaining < 0 || s.pct >= 1 ? 'over' : s.pct >= 0.8 ? 'warn' : 'ok';
            return (
              <button key={s.pot.id} className={`pot ${level}`} onClick={() => onAsk(`wetin remain for ${s.pot.name}`)}>
                <div className="pot-top">
                  <span className="pot-title">{s.pot.emoji} {s.pot.name}</span>
                  <span className="pot-left">{s.remaining < 0 ? `−${formatNaira(-s.remaining)}` : formatNaira(s.remaining)}</span>
                </div>
                <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.pot.name} used`}><div style={{ width: `${pct}%` }} /></div>
                <div className="pot-bottom">
                  <span>{formatNaira(s.spent)} of {formatNaira(s.budget)}</span>
                  <span>{s.remaining > 0 ? `about ${formatNaira(s.perDay)} a day` : s.remaining < 0 ? 'over budget' : 'used up'}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!hasEntries && (
        <div className="empty">
          <h3>Tap the yellow button and talk</h3>
          <ul>
            <li>“Salary don land, 200k”</li>
            <li>“I chop 1,500 for mama put”</li>
            <li>“I enter keke 800 and buy data 2k”</li>
            <li>“Wetin remain for my feeding?”</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export const STATUS_TEXT: Record<SyncStatus, string> = {
  guest: 'Saved on this phone only',
  syncing: 'Saving to your account…',
  synced: 'Saved to your account',
  offline: 'Offline. Changes will save when you reconnect',
  error: 'Couldn\'t reach your account. Will retry',
};
