'use client';
import { useState } from 'react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** Başlığın sağındaki küçük yazı — örn. "27 soru". */
  badge?: string;
  /**
   * Dışarıdan AÇIK tutmaya zorlar. Bir soru düzenlenirken kullanılır: havuz
   * kapanırsa Zafer Hoca hangi soruda olduğunu göremez.
   */
  forceOpen?: boolean;
  /** Bölüm rengi (EX_MODES.color) — başlık ve kenarlık bu renkle uyumlanır. */
  accentColor?: string;
  children: ReactNode;
}

/**
 * Admin panelinde kalabalık listeleri gizleyen açılır kart.
 *
 * components/play/StepCard.tsx YENİDEN KULLANILMADI: o bileşen sporcu temasının
 * sınıflarını (t-card-i) ve adım numarası/kilit mantığını taşıyor; admin paneli
 * ayrı bir görsel dil (neon) kullanıyor. Sporcu bileşenine admin desteği eklemek
 * iki ekranı birbirine bağlardı.
 */
export function CollapsibleCard({ title, badge, forceOpen = false, accentColor, children }: Props) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: accentColor
          ? `color-mix(in srgb, ${accentColor} 35%, transparent)`
          : 'rgba(255,255,255,0.15)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-sm font-bold" style={{ color: accentColor }}>{title}</span>
        <span className="flex items-center gap-2 text-xs n-muted flex-shrink-0">
          {badge && <span>{badge}</span>}
          <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
        </span>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
