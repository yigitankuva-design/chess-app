'use client';
import { Fragment, useEffect, useState } from 'react';
import { toTurkishSan } from '@/lib/chess/analysisFormat';
import { classifyMoveQuality } from '@/lib/chess/moveQuality';
import type { WhiteScore } from '@/lib/chess/moveQuality';

export interface NotationMove {
  ply: number;
  san: string;
  fenAfter: string;
  /** Madde 2026-09-06 (7): bu hamle yerine denenen TEK SEVİYELİ alternatif
   *  devam (varsa) — bkz. lib/chess/variantMoves.ts. */
  variant?: NotationMove[];
}

export interface ActiveVariant {
  /** Alternatifin bağlı olduğu ANA HAT ply'ı. */
  atPly: number;
  /** Varyant içindeki konum (1 tabanlı — variant[index-1] aktif hamle). */
  index: number;
}

interface Props {
  moves: NotationMove[];
  /** Verilirse aktif hamle vurgulanır ve tıklanabilir olur (Maçlarımın Analizi). */
  currentPly?: number;
  onSelectPly?: (ply: number) => void;
  hideNotation: boolean;
  onToggleHideNotation: () => void;
  /** Madde 2026-09-05 (3): sağ tık menüsündeki "Bu Hamleden Sonrasını Sil". */
  onDeleteAfter?: (ply: number) => void;
  /** Madde 2026-09-05 (3): hamle kalitesi işaretleri (?/??/!/!!) için
   *  ply→skor haritası — 0 = başlangıç, N = N. hamleden sonrası (Beyaz açısından). */
  evalByPly?: Record<number, WhiteScore>;
  /** Arka planda kaç ply değerlendirildi / toplam kaç ply var — verilirse ve
   *  bitmemişse küçük bir "değerlendiriliyor" satırı gösterilir. */
  evalProgress?: { done: number; total: number };
  /** Madde 2026-09-06 (7): şu an bir varyant mı gösteriliyor — verilirse
   *  mainline vurgusu kapanır, o varyantın ilgili hamlesi vurgulanır. */
  activeVariant?: ActiveVariant | null;
  /** Bir varyant hamlesine tıklanınca çağrılır. */
  onSelectVariantPly?: (atPly: number, index: number) => void;
}

interface MovePair {
  moveNumber: number;
  white?: NotationMove;
  black?: NotationMove;
}

function buildPairs(moves: NotationMove[]): MovePair[] {
  const pairs: MovePair[] = [];
  moves.forEach((m) => {
    const moveNumber = Math.ceil(m.ply / 2);
    let pair = pairs.find((p) => p.moveNumber === moveNumber);
    if (!pair) { pair = { moveNumber }; pairs.push(pair); }
    if (m.ply % 2 === 1) pair.white = m; else pair.black = m;
  });
  return pairs;
}

interface MenuState {
  x: number;
  y: number;
  move: NotationMove;
}

/**
 * Analiz Et sekmesi — madde 2026-09-05 (4): "Hamleler" kartı, kullanıcının
 * gönderdiği görsele göre tasarlandı — başlık + "Notasyon Verilerini Gizle"
 * onay kutusu üstte (ayırıcı çizgiyle), altında 3 TAM hamle/satır sabit
 * genişlikte grid, her hücre "N. beyaz - siyah" biçiminde (siyah henüz
 * oynanmadıysa sondaki "-" yine de görünür). Maçlarımın Analizi ve Yeni
 * Analiz'de AYNI tasarım kullanılır.
 *
 * Madde (3): bir hamleye SAĞ TIKLAYINCA "FEN Kopyala" / "Bu Hamleden
 * Sonrasını Sil" seçenekli bir menü açılır.
 */
const QUALITY_COLOR = { bad: '#f87171', good: '#7dd3fc' } as const;

export function NotationCard({
  moves, currentPly, onSelectPly, hideNotation, onToggleHideNotation, onDeleteAfter,
  evalByPly, evalProgress, activeVariant, onSelectVariantPly,
}: Props) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  function openMenu(e: React.MouseEvent, move: NotationMove) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, move });
  }

  async function copyFen() {
    const m = menu?.move;
    setMenu(null);
    if (!m) return;
    try {
      await navigator.clipboard.writeText(m.fenAfter);
    } catch {
      /* pano erişimi yoksa sessizce yoksay — kritik olmayan bir kolaylık. */
    }
  }

  function deleteAfter() {
    const m = menu?.move;
    setMenu(null);
    if (m) onDeleteAfter?.(m.ply);
  }

  const pairs = buildPairs(moves);
  const clickable = !!onSelectPly;

  /** Madde 2026-09-06 (7): bir hamlenin altına, girintili küçük punto bir
   *  alt-satır olarak alternatif devamı gösterir (Lichess'ten esinlenilen
   *  KAVRAM — tasarım/kod kendimize özgü). */
  const variantRow = (atPly: number, variant: NotationMove[]) => {
    const moveNo = Math.ceil(atPly / 2);
    return (
      <div key={`variant-${atPly}`} className="whitespace-nowrap overflow-x-auto text-[0.78em] pl-3 t-muted"
        style={{ gridColumn: '1 / -1' }}>
        <span aria-hidden="true">↳ {moveNo}{atPly % 2 === 0 ? '…' : '.'}{' '}</span>
        {variant.map((vm) => {
          const active = !!activeVariant && activeVariant.atPly === atPly && activeVariant.index === vm.ply;
          const label = toTurkishSan(vm.san);
          if (!onSelectVariantPly) return <span key={vm.ply} className="px-0.5">{label}</span>;
          return (
            <button key={vm.ply} type="button" onClick={() => onSelectVariantPly(atPly, vm.ply)}
              className="rounded px-0.5"
              style={{ background: active ? 'rgba(34,211,238,0.25)' : undefined, fontWeight: active ? 700 : undefined }}>
              {label}
            </button>
          );
        })}
      </div>
    );
  };

  const moveCell = (m: NotationMove) => {
    const active = !activeVariant && currentPly === m.ply;
    const mover: 'w' | 'b' = m.ply % 2 === 1 ? 'w' : 'b';
    const before = evalByPly?.[m.ply - 1];
    const after = evalByPly?.[m.ply];
    const quality = before && after ? classifyMoveQuality(before, after, mover) : null;
    const label = toTurkishSan(m.san) + (quality?.symbol ?? '');
    const qualityColor = quality ? QUALITY_COLOR[quality.tone] : undefined;
    if (!clickable) {
      return (
        <span className="px-0.5" style={qualityColor ? { color: qualityColor, fontWeight: 700 } : undefined}
          onContextMenu={(e) => openMenu(e, m)}>{label}</span>
      );
    }
    return (
      <button type="button" onClick={() => onSelectPly!(m.ply)} onContextMenu={(e) => openMenu(e, m)}
        className="rounded px-0.5"
        style={{
          background: active ? 'rgba(34,211,238,0.25)' : undefined,
          color: qualityColor, fontWeight: qualityColor ? 700 : undefined,
        }}>
        {label}
      </button>
    );
  };

  return (
    <div className="rounded-xl border-2 border-white/20 p-3">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/15">
        <p className="font-bold text-sm t-premium">Hamleler</p>
        <label className="flex items-center gap-1.5 text-xs t-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideNotation}
            onChange={onToggleHideNotation}
            aria-label="Notasyon Verilerini Gizle"
            className="h-3.5 w-3.5"
            style={{ accentColor: 'var(--t-accent)' }}
          />
          Notasyon Verilerini Gizle
        </label>
      </div>

      {evalProgress && evalProgress.done < evalProgress.total && (
        <p className="text-[0.7rem] t-muted mb-1.5">
          Hamleler değerlendiriliyor... ({evalProgress.done}/{evalProgress.total})
        </p>
      )}

      {moves.length === 0 ? (
        <p className="text-xs t-muted">Henüz hamle yok.</p>
      ) : (
        <div className="grid gap-x-1 gap-y-1.5 text-xs font-mono"
          style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {pairs.map((p) => (
            <Fragment key={p.moveNumber}>
              <div className="whitespace-nowrap overflow-hidden text-ellipsis">
                <span className="t-muted">{p.moveNumber}.</span>
                {p.white && moveCell(p.white)}
                {'-'}
                {p.black && moveCell(p.black)}
              </div>
              {p.white?.variant && variantRow(p.white.ply, p.white.variant)}
              {p.black?.variant && variantRow(p.black.ply, p.black.variant)}
            </Fragment>
          ))}
        </div>
      )}

      {menu && (
        <div
          className="fixed z-50 rounded-lg border border-white/20 py-1 t-card-i"
          style={{ left: menu.x, top: menu.y, minWidth: 190 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={copyFen}
            className="block w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors">
            FEN Kopyala
          </button>
          <button type="button" onClick={deleteAfter}
            className="block w-full text-left px-3 py-2 text-xs text-rose-300 hover:bg-white/10 transition-colors">
            Bu Hamleden Sonrasını Sil
          </button>
        </div>
      )}
    </div>
  );
}
