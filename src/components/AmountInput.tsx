import { useEffect, useState } from 'react';
import { findAmounts, formatNaira } from '../lib/money';
import { normalise } from '../lib/parser';

/** Parses what people type in an amount box: "2k", "1.5k", "₦2,500", "fifty thousand". */
export function parseAmountText(s: string): number | null {
  const found = findAmounts(normalise(s));
  return found.length ? found[0].value : null;
}

interface Props {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}

export function AmountInput({ value, onChange, placeholder = '0', ariaLabel, autoFocus }: Props) {
  const [text, setText] = useState(value ? String(value) : '');
  useEffect(() => {
    setText((t) => (parseAmountText(t) === value ? t : value ? String(value) : ''));
  }, [value]);
  const parsed = parseAmountText(text);
  return (
    <div className="amount-input">
      <span className="naira">₦</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseAmountText(e.target.value);
          onChange(n ?? 0);
        }}
      />
      {text && parsed !== null && String(parsed) !== text.trim() && <span className="amount-hint">{formatNaira(parsed)}</span>}
    </div>
  );
}
