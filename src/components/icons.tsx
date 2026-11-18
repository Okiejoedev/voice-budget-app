// Small hand-drawn icon set (stroke icons, 24px grid) so the app has no icon-font dependency.
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const IconHome = () => (<svg {...base}><path d="M4 11.5 12 5l8 6.5" /><path d="M6.5 10v9h11v-9" /></svg>);
export const IconPlan = () => (<svg {...base}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></svg>);
export const IconList = () => (<svg {...base}><path d="M9 7h11M9 12h11M9 17h11" /><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" /></svg>);
export const IconMe = () => (<svg {...base}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.4-3.2 4-4.5 7-4.5s5.6 1.3 7 4.5" /></svg>);
export const IconMic = () => (<svg {...base} strokeWidth={2.2}><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" /></svg>);
export const IconKeyboard = () => (<svg {...base}><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M8 14h8" /></svg>);
export const IconSend = () => (<svg {...base} strokeWidth={2.2}><path d="M5 12h13M13 6l6 6-6 6" /></svg>);
export const IconStop = () => (<svg {...base}><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /></svg>);

export const GoogleLogo = () => (
  <svg className="g-logo" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/** The Kolo: a traditional clay money box, standing in for the savings vault. */
export const KoloArt = ({ className = 'kolo-art' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 84 84" aria-hidden="true">
    <ellipse cx="42" cy="76" rx="24" ry="4" fill="#d6dad3" />
    <path d="M18 44c0-15 10.7-26 24-26s24 11 24 26-10.7 30-24 30-24-15-24-30z" fill="#22335e" />
    <path d="M30 22c3.4-2.6 7.5-4 12-4s8.6 1.4 12 4" stroke="#ffc629" strokeWidth="4" strokeLinecap="round" fill="none" />
    <rect x="34" y="27" width="16" height="4" rx="2" fill="#ffc629" />
    <path d="M24 50c5 3 11 4.5 18 4.5S55 53 60 50" stroke="#3b4d7d" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M27 60c4.5 2.2 9.5 3.3 15 3.3s10.5-1.1 15-3.3" stroke="#3b4d7d" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);
