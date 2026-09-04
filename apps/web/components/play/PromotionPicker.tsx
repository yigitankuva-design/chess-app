'use client';
import { PROMOTION_CHOICES } from '@/lib/play/promotion';
import type { PromotionPiece } from '@/lib/play/promotion';
import { pieceSetUris } from '@/lib/pieceSets';

interface Props {
  /** Terfi eden piyonun rengi — hangi taşın (beyaz/siyah) gösterileceğini belirler. */
  color: 'w' | 'b';
  onPick: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

/** Madde 2026-09-06 (1): kartlardaki taşlar artık Cburnett SVG seti. */
const CBURNETT = pieceSetUris('cburnett');

/** Piyon terfi ettiginde acilan secim penceresi (madde 2).
 *  Otomatik vezir YOK — sporcu Vezir/Kale/Fil/At arasindan secer. */
export function PromotionPicker({ color, onPick, onCancel }: Props) {
  return (
    <div
      role="dialog"
      aria-label="Terfi taşını seç"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div className="t-card-i p-5 w-full max-w-xs space-y-4">
        <p className="font-bold text-sm text-center">Piyonun ne olsun?</p>
        <div className="grid grid-cols-4 gap-2">
          {PROMOTION_CHOICES.map((c) => (
            <button
              key={c.piece}
              type="button"
              aria-label={c.label}
              onClick={() => onPick(c.piece)}
              className="t-card-i flex flex-col items-center justify-center gap-1 py-3"
            >
              <img
                src={CBURNETT[`${color}${c.piece.toUpperCase()}`]}
                alt=""
                aria-hidden="true"
                className="w-[50px] h-[50px]"
              />
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancel} className="t-btn-ghost w-full py-2 text-sm">
          Vazgeç
        </button>
      </div>
    </div>
  );
}
