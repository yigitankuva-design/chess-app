'use client';
import type { ReactNode } from 'react';

interface Props {
  /** Kart basligi. */
  title: string;
  /** Dis kartlar icin emoji (🤖 / 🤝). Ic kartlarda kullanilmaz. */
  emoji?: string;
  /** Ic kartlar icin adim numarasi (1 / 2). Dis kartlarda kullanilmaz. */
  stepNumber?: number;
  /** Tamamlanmis adimin basliktaki ozeti ("✓ Italyan Acilisi"). */
  summary?: string | null;
  open: boolean;
  /** Kilitliyse soluk gorunur ve tiklama onToggle cagirmaz. */
  locked?: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** Sirali akordiyon karti. Is mantigi YOK — acik/kilitli kararini cagiran verir. */
export function StepCard({
  title, emoji, stepNumber, summary, open, locked = false, onToggle, children,
}: Props) {
  const label = stepNumber === undefined ? title : `${stepNumber}. ${title}`;
  return (
    <div className="t-card-i overflow-hidden">
      <button
        type="button"
        onClick={() => { if (!locked) onToggle(); }}
        aria-expanded={open}
        aria-disabled={locked}
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
        style={locked ? { opacity: 0.5 } : undefined}
      >
        {emoji && <span className="text-2xl">{emoji}</span>}
        <span className="font-semibold text-sm flex-1">{label}</span>
        {summary && <span className="text-xs t-muted">{summary}</span>}
        <span className="text-sm t-muted" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
