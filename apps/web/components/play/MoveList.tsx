'use client';
import { useEffect, useRef } from 'react';
import { parseFenStart } from '@/lib/play/moveList';
import { turkishMoveRows } from '@/lib/play/sanTr';
import type { TurkishMove } from '@/lib/play/sanTr';
import { useBoardNotation } from '@/lib/board-notation-context';
import { classifyMoveQuality } from '@/lib/chess/moveQuality';
import type { WhiteScore } from '@/lib/chess/moveQuality';

/** NotationCard.tsx'teki AYNI renk eşlemesi — analiz ekranlarında hamle
 *  kalitesi işaretleri her yerde aynı görünsün. */
const QUALITY_COLOR = { bad: '#f87171', good: '#7dd3fc' } as const;

interface Props {
  /** Oynanan hamleler (SAN, chess.js'ten İngilizce gelir). */
  san: string[];
  /** Macin basladigi konum — acilis pratiginde standart degildir. */
  startFen?: string | null;
  /** Verilirse hamleler TIKLANABILIR olur ve secilen yari-hamle sirasi
   *  bildirilir (madde 1). Verilmezse hamleler duz metin kalir. */
  onSelectPly?: (ply: number) => void;
  /** O anda tahtada gosterilen yari-hamle — gorsel olarak isaretlenir. */
  activePly?: number;
  /** Madde 2026-09-14 (3a): verilirse (Analiz Et özet ekranı) hamlelerin
   *  yanına NotationCard.tsx'teki AYNI kalite işaretleri (?/??/!/!!) ve
   *  renk eklenir — ply→skor haritası, 0 = başlangıç (Beyaz açısından). */
  evalByPly?: Record<number, WhiteScore>;
}

/** Tahtanin ALTINDA duran hamle notasyonu (madde 1/3).
 *  Hamleler YAN YANA akar, satir bitince alt satirdan devam eder:
 *  "1. e4 – e5, 2. Af3 – Ac6, 3. Fc4 – Fc5 …"  Yazim TURKCEDIR. */
export function MoveList({ san, startFen, onSelectPly, activePly, evalByPly }: Props) {
  const rows = turkishMoveRows(san, parseFenStart(startFen));
  const boxRef = useRef<HTMLDivElement>(null);
  const { hideNotation, toggleHideNotation } = useBoardNotation();

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [san.length]);

  /** Tek bir hamle. onSelectPly yoksa buton URETILMEZ — eski ekranlarda
   *  notasyon aynen duz metin kalir. */
  function move(m: TurkishMove | null, fallback: string) {
    if (!m) return <>{fallback}</>;
    const mover: 'w' | 'b' = m.ply % 2 === 1 ? 'w' : 'b';
    const before = evalByPly?.[m.ply - 1];
    const after = evalByPly?.[m.ply];
    const quality = before && after ? classifyMoveQuality(before, after, mover) : null;
    const label = m.san + (quality?.symbol ?? '');
    const qualityColor = quality ? QUALITY_COLOR[quality.tone] : undefined;
    if (!onSelectPly) {
      return <span style={qualityColor ? { color: qualityColor, fontWeight: 700 } : undefined}>{label}</span>;
    }
    const active = activePly === m.ply;
    return (
      <button
        type="button"
        onClick={() => onSelectPly(m.ply)}
        aria-current={active ? 'true' : undefined}
        className="underline-offset-2 hover:underline"
        style={{
          fontWeight: active || qualityColor ? 700 : undefined,
          textDecoration: active ? 'underline' : undefined,
          color: qualityColor,
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <section aria-label="Hamleler"
      /* Genislik TAHTAYLA AYNI: notasyon tahta hizasini gecmez. Madde
         2026-09-06 (ucuncu tur/5): cerceve rengi tema uyumlu (t-card-i'nin
         varsayilan norotr sinirini SADECE burada accent'e cevirir). */
      className="t-card-i mt-3 p-3 w-full max-w-[600px] mx-auto"
      style={{ borderColor: 'var(--t-accent)' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold t-muted uppercase tracking-widest">
          Hamleler
        </p>
        <label className="flex items-center gap-1.5 text-xs t-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideNotation}
            onChange={toggleHideNotation}
            aria-label="Notasyon Verilerini Gizle"
            className="h-3.5 w-3.5"
            style={{ accentColor: 'var(--t-accent)' }}
          />
          Notasyon Verilerini Gizle
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm t-muted">Henüz hamle yapılmadı.</p>
      ) : (
        <div ref={boxRef} className="max-h-32 overflow-y-auto overflow-x-hidden">
          {/* Madde 2026-09-06 (4): NotationCard'daki AYNI sabit 3-sütun grid —
              satır sayısı içerik uzunluğuna göre değil, HER ZAMAN 3 hamle/satır. */}
          <div className="grid gap-x-1 gap-y-1.5 text-xs font-mono"
            style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {rows.map((r) => (
              <div key={r.no} className="whitespace-nowrap overflow-hidden text-ellipsis">
                <span className="t-muted">{r.no}.</span>
                {move(r.white, '…')}
                {r.black ? <>{'-'}{move(r.black, '')}</> : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
