import { IconMic } from './icons';

export function Splash({ message = 'Opening your money…' }: { message?: string }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="mark">
        <div className="pulse-dot"><span style={{ color: 'var(--ink)' }}><IconMic /></span></div>
        <div className="word">Voice Budget</div>
        <div className="sub">{message}</div>
      </div>
    </div>
  );
}
