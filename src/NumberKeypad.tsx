import { useCallback, useEffect } from 'react';
import type { SyntheticEvent } from 'react';
import { Delete } from 'lucide-react';

function sanitizeKeypadValue(value: string, maxWholeDigits: number, maxFractionDigits: number) {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [whole = '', ...fractionParts] = normalized.split('.');
  const leadingDecimal = normalized.startsWith('.');
  const limitedWhole = whole.slice(0, maxWholeDigits);

  if (fractionParts.length === 0 && whole.length > maxWholeDigits) {
    return `${limitedWhole}.${whole.slice(maxWholeDigits, maxWholeDigits + maxFractionDigits)}`;
  }

  if (fractionParts.length === 0) return limitedWhole;
  return `${leadingDecimal ? '0' : limitedWhole}.${fractionParts.join('').slice(0, maxFractionDigits)}`;
}

export function isKeypadValueValid(value: string) {
  return /^(?:\d{1,2}(?:\.\d{1,2})?|(?:0)?\.\d{1,2})$/.test(value) && Number.isFinite(Number(value));
}

export default function NumberKeypad({
  value,
  onChange,
  onSubmit,
  submitDisabled,
  submitLabel = 'Submit',
  maxWholeDigits = 2,
  maxFractionDigits = 2,
  enableKeyboard = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitDisabled?: boolean;
  submitLabel?: string;
  maxWholeDigits?: number;
  maxFractionDigits?: number;
  enableKeyboard?: boolean;
}) {
  const append = useCallback((character: string) => {
    if (character === '.' && value.includes('.')) return;
    onChange(sanitizeKeypadValue(`${value}${character}`, maxWholeDigits, maxFractionDigits));
  }, [maxFractionDigits, maxWholeDigits, onChange, value]);

  const backspace = useCallback(() => {
    onChange(value.slice(0, -1));
  }, [onChange, value]);

  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        append(event.key);
        return;
      }

      if (event.key === '.' || event.key === ',') {
        event.preventDefault();
        append('.');
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        backspace();
        return;
      }

      if (event.key === 'Enter' && !submitDisabled) {
        event.preventDefault();
        onSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [append, backspace, enableKeyboard, onSubmit, submitDisabled]);

  const keyClass = 'min-h-12 rounded-2xl bg-white border border-slate-200 text-slate-800 text-2xl font-black shadow-sm transition-all active:scale-95 hover:border-teal-300';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const stopEvent = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      className="grid grid-cols-3 gap-2"
      aria-label="Number keypad"
      onClick={stopEvent}
      onPointerDown={stopEvent}
      onTouchStart={stopEvent}
    >
      {keys.map(key => (
        <button key={key} type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); append(key); }} className={keyClass}>
          {key}
        </button>
      ))}

      <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); append('.'); }} className={keyClass} aria-label="Decimal point">
        .
      </button>
      <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); append('0'); }} className={keyClass}>
        0
      </button>
      <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); backspace(); }} className={keyClass} aria-label="Delete">
        <Delete className="w-6 h-6 mx-auto" />
      </button>

      <button
        type="button"
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); onSubmit(); }}
        disabled={submitDisabled}
        className="col-span-3 min-h-12 rounded-2xl bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-lg font-black shadow-lg shadow-teal-500/25 disabled:shadow-none transition-all active:scale-[0.98]"
      >
        {submitLabel}
      </button>
    </div>
  );
}
