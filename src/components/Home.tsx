import type { AppState } from '../lib/types';
import { periodLabel, potStatuses, summary } from '../lib/engine';
import { formatNaira } from '../lib/money';

interface Props { state: AppState; onAsk: (text: string) => void }

export function Home({ state, onAsk }: Props) {
  const sum = summary(state);
  const statuses = potStatuses(state).filter((s) => s.budget > 0 || s.spent > 0);
  const name = state.settings.name;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="home">
      <div className="greet">{greet}{name ? `, ${name}` : ''} 👋</div>

      <section className="hero-card">
        <div className="label">Safe to spend today</div>
        <div className="big-num">{formatNaira(sum.safeToday)}</div>
        <div className="sub">
          {formatNaira(sum.remaining)} left in your pots · {sum.daysLeft} day{sum.daysLeft === 1 ? '' : 's'} to go
        </div>
        <div className="sub small">{periodLabel(sum.period)}</div>
      </section>

      <div className="stat-grid">
        <div className="stat vault">
          <div className="label">🔒 Savings vault</div>
          <div className="num">{formatNaira(sum.vault)}</div>
        </div>
        <div className="stat">
          <div className="label">💰 Income this month</div>
          <div className="num">{formatNaira(sum.income)}</div>
        </div>
        {sum.income === 0 ? (
          <div className="stat">
            <div className="label">🆓 Free money</div>
            <div className="num small muted">Log income to see</div>
          </div>
        ) : (
          <div className={`stat ${sum.freeMoney < 0 ? 'neg' : ''}`}>
            <div className="label">{sum.freeMoney < 0 ? '⚠️ Planned more than earned' : '🆓 Free money (no job yet)'}</div>
            <div className="num">{formatNaira(sum.freeMoney)}</div>
          </div>
        )}
        <div className="stat">
          <div className="label">🧾 Spent this month</div>
          <div className="num">{formatNaira(sum.spent)}</div>
        </div>
      </div>

      <h2 className="section-title">Your pots</h2>
      {statuses.length === 0 && <p className="muted">No pots yet. Say "put 20k for data, 60k for transport" or open Plan.</p>}
      <div className="pots">
        {statuses.map((s) => {
          const pct = Math.min(100, Math.round(s.pct * 100));
          const level = s.remaining < 0 || s.pct >= 1 ? 'over' : s.pct >= 0.8 ? 'warn' : 'ok';
          return (
            <button key={s.pot.id} className={`pot ${level}`} onClick={() => onAsk(`wetin remain for ${s.pot.name}`)}>
              <div className="pot-top">
                <span className="pot-title">{s.pot.emoji} {s.pot.name}</span>
                <span className="pot-left">{s.remaining < 0 ? `-${formatNaira(-s.remaining)}` : formatNaira(s.remaining)} left</span>
              </div>
              <div className="bar"><div style={{ width: `${pct}%` }} /></div>
              <div className="pot-bottom">
                <span>{formatNaira(s.spent)} of {formatNaira(s.budget)}{s.pot.carry > 0 ? ` (incl. ${formatNaira(s.pot.carry)} rolled over)` : ''}</span>
                <span>{s.remaining > 0 ? `~${formatNaira(s.perDay)}/day` : ''}</span>
              </div>
            </button>
          );
        })}
      </div>

      {state.transactions.filter((t) => t.source !== 'system').length === 0 && (
        <section className="card tips">
          <h2>Try saying</h2>
          <ul>
            <li>"Salary don land, 200k"</li>
            <li>"I chop 1,500 for mama put"</li>
            <li>"I enter keke 800 and buy data 2k"</li>
            <li>"Wetin remain for my feeding?"</li>
            <li>"Put 50k for savings"</li>
          </ul>
        </section>
      )}
    </div>
  );
}
