import { useEffect, useState } from 'react';
import { GoogleLogo } from './icons';
import { formatNaira } from '../lib/money';

// Each line is spoken, then lands in the ledger, and "safe to spend" updates.
const SCRIPT = [
  { said: 'Salary don land, 200k', icon: '💰', title: 'Salary', sub: 'Income', amount: 200000, safe: 17500 },
  { said: 'I chop 1,500 for mama put', icon: '🍲', title: 'Mama put', sub: 'Feeding', amount: -1500, safe: 17312 },
  { said: 'I enter keke 800', icon: '🛺', title: 'Keke', sub: 'Transport', amount: -800, safe: 17212 },
];

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface Props {
  onGoogle: () => void;
  onGuest: () => void;
  error: string | null;
  busy: boolean;
}

export function Welcome({ onGoogle, onGuest, error, busy }: Props) {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(reduceMotion() ? SCRIPT[0].said : '');
  const [landed, setLanded] = useState(reduceMotion());
  const line = SCRIPT[i];

  useEffect(() => {
    if (reduceMotion()) return;
    let n = 0;
    setTyped('');
    setLanded(false);
    const typer = setInterval(() => {
      n++;
      setTyped(line.said.slice(0, n));
      if (n >= line.said.length) clearInterval(typer);
    }, 45);
    const land = setTimeout(() => setLanded(true), line.said.length * 45 + 450);
    const next = setTimeout(() => setI((x) => (x + 1) % SCRIPT.length), line.said.length * 45 + 2600);
    return () => { clearInterval(typer); clearTimeout(land); clearTimeout(next); };
  }, [i, line.said]);

  return (
    <div className="welcome">
      <div className="top"><span className="logo-dot">₦</span> Voice Budget</div>
      <h1>Talk your money.</h1>
      <p className="lede">Say what you spent, in English or Pidgin. Voice Budget keeps the count and tells you what's safe to spend today.</p>

      <div className="demo" aria-hidden="true">
        <div className="said">“{typed}{!landed && <span className="caret" />}”</div>
        <div className={`entry ${landed ? 'show' : ''}`}>
          <span style={{ fontSize: '1.4rem' }}>{line.icon}</span>
          <span className="what"><b>{line.title}</b><span className="small muted">{line.sub}</span></span>
          <span className={`amt ${line.amount > 0 ? 'in' : ''}`}>{line.amount > 0 ? '+' : '−'}{formatNaira(Math.abs(line.amount))}</span>
        </div>
        <div className={`meter ${landed ? 'show' : ''}`}>Safe to spend today <b>{formatNaira(line.safe)}</b></div>
      </div>

      <div className="actions">
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="btn google block" onClick={onGoogle} disabled={busy}>
          <GoogleLogo /> {busy ? 'Opening Google…' : 'Continue with Google'}
        </button>
        <button className="btn ghost block" onClick={onGuest}>Use without an account</button>
        <p className="fine">
          Your entries are private to you. <a href={`${import.meta.env.BASE_URL}privacy.html`}>Privacy notice</a>
        </p>
      </div>
    </div>
  );
}
