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
  /** Icerik yan bosluksuz cizilir. Kriter secim alani (MatchCriteria) kendi
   *  kartlarini tasidigi icin ustune bir kart daha binmesin — boylece secim
   *  alani her bolumde AYNI genislikte gorunur (madde 5). */
  flush?: boolean;
  /**
   * Bota Karşı Pratik Yap'ın 3 dış adımını (Tür/Konum/Kriter) birbirinden
   * ayırt etmek için AYNI accent renginin 3 farklı tonu (1=en güçlü,
   * 3=en soluk). Verilmezse tema varsayılan tek-tonlu görünüm kullanılır —
   * diğer StepCard kullanımları (Arkadaşa Karşı akışı vb.) ETKİLENMEZ.
   */
  tone?: 1 | 2 | 3;
  onToggle: () => void;
  children: ReactNode;
}

const TONE_PCT: Record<1 | 2 | 3, number> = { 1: 100, 2: 68, 3: 40 };

/** Sirali akordiyon karti. Is mantigi YOK — acik/kilitli kararini cagiran verir. */
export function StepCard({
  title, emoji, stepNumber, summary, open, locked = false, flush = false,
  tone, onToggle, children,
}: Props) {
  const label = stepNumber === undefined ? title : `${stepNumber}. ${title}`;
  const toneStyle = tone ? {
    borderColor: `color-mix(in srgb, var(--t-accent) ${TONE_PCT[tone]}%, var(--t-border))`,
    boxShadow: `0 0 18px -6px color-mix(in srgb, var(--t-glow) ${TONE_PCT[tone]}%, transparent)`,
  } : undefined;
  return (
    <div className="t-card-i overflow-hidden" style={toneStyle}>
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
      {open && <div className={flush ? 'pb-1' : 'px-4 pb-4'}>{children}</div>}
    </div>
  );
}
