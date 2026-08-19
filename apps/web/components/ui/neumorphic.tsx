'use client';
import type { ReactNode, CSSProperties } from 'react';

/**
 * "Maç Yap" ve "Dersler" sekmelerinde kullanılan kabartılmış/gömük
 * (neumorphic) yumuşak-kabuk tasarım — yuvarlak ikon düğmeler + aralarında
 * ince kesikli çizgi. Eskiden yalnızca app/(child)/home/page.tsx içindeydi;
 * artık Pratik Yap ekranı da (CustomTabPanel, OpeningPractice) AYNI
 * tasarımı kullansın diye buraya taşındı (2026-08-19 kararı).
 */

export const SH_DARK = 'color-mix(in srgb, var(--t-surface) 55%, #000)';
export const SH_LIGHT = 'color-mix(in srgb, var(--t-surface) 84%, #fff)';

export function raised(radius: number | string = 14, depth = 5): CSSProperties {
  return {
    background: 'var(--t-surface)',
    borderRadius: radius,
    border: 'none',
    boxShadow: `${depth}px ${depth}px ${depth * 2}px ${SH_DARK}, -${depth}px -${depth}px ${depth * 2}px ${SH_LIGHT}`,
  };
}

export function pressed(radius: number | string = 14, depth = 4): CSSProperties {
  return {
    background: 'var(--t-surface)',
    borderRadius: radius,
    border: 'none',
    boxShadow: `inset ${depth}px ${depth}px ${depth * 2}px ${SH_DARK}, inset -${depth}px -${depth}px ${depth * 2}px ${SH_LIGHT}`,
  };
}

/** Patika düğümü: yuvarlak kabartma buton + yanında etiket.
 *  `locked` verilirse soluklaşır ve tıklama devre dışı kalır (StepCard'ın
 *  kilit davranışının PathNode karşılığı, 2026-08-19). `trailing` verilirse
 *  sağ kenarda ek bir öğe gösterilir (örn. konum sayısı rozeti). `tint`
 *  verilirse etiket AÇIK/KAPALI farketmeksizin HER ZAMAN o renkte kalır —
 *  bir sekmenin alt öğeleri, o sekmenin kendi rengiyle eşleşsin diye
 *  (2026-08-19). Verilmezse eski davranış (kapalıyken beyaz, açıkken
 *  accent) aynen sürer — Dersler bu prop'u KULLANMAZ, bilerek beyaz kalır. */
export function PathNode({
  icon, label, active, size, onClick, labelColor, locked = false, trailing, tint,
}: {
  icon: ReactNode; label: string; active: boolean; size: number; onClick: () => void;
  labelColor?: string; locked?: boolean; trailing?: ReactNode; tint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => { if (!locked) onClick(); }}
      aria-disabled={locked}
      className="flex items-center gap-3 w-full text-left transition-transform active:scale-[0.98]"
      style={{
        background: 'transparent', border: 'none', padding: 0,
        cursor: locked ? 'default' : 'pointer',
        opacity: locked ? 0.5 : 1,
      }}
    >
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{ ...(active ? pressed(999, 3) : raised(999, 4)), width: size, height: size, fontSize: size * 0.44 }}
      >
        {icon}
      </span>
      <span
        className="font-bold leading-tight flex-1"
        style={{
          fontSize: size >= 40 ? '0.86rem' : size >= 34 ? '0.8rem' : '0.75rem',
          color: tint ?? (active ? (labelColor ?? 'var(--t-accent)') : 'var(--t-text-1)'),
        }}
      >
        {label}
      </span>
      {trailing}
    </button>
  );
}

/** Katmanlar arası kesikli bağlantı çizgisi. */
export function Branch({ offset, children }: { offset: number; children: ReactNode }) {
  return (
    <div
      style={{
        marginLeft: offset,
        paddingLeft: 18,
        borderLeft: `2px dashed ${SH_LIGHT}`,
        marginTop: 10,
        display: 'grid',
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

/** İki düğüm arasındaki kısa dikey ayraç (Maç Yap'ın "Nasıl Oynayalım?" listesinde kullanılan tür). */
export function VerticalDivider({ marginLeft = 21 }: { marginLeft?: number }) {
  return (
    <div style={{ width: 2, height: 14, background: SH_LIGHT, marginLeft, borderRadius: 9, opacity: 0.7 }} />
  );
}
