/** Bir eksik taş ve onun gitmesi gereken kare. */
export interface PiecePlacement {
  /** FEN harfi — büyük=beyaz, küçük=siyah (bkz. lib/chess/pieceCodes.ts). */
  piece: string;
  square: string;
}

export interface PlacementResult {
  ok: boolean;
  /** Doğruysa yerleştirilen taş çıkarılmış liste; yanlışsa liste aynen. */
  remaining: PiecePlacement[];
}

/**
 * Sporcunun bir taşı bir kareye koymasını değerlendirir.
 *
 * Sıra SERBESTTİR: hangi taşın önce konduğu önemli değil, sadece taşın kendi
 * karesine konması aranır. Aynı taştan birden fazla olabileceği için eşleşme
 * hem taşa hem kareye bakılarak yapılır (iki kale a1/h1 örneği).
 */
export function evaluatePlacement(
  pending: PiecePlacement[],
  piece: string,
  square: string,
): PlacementResult {
  const idx = pending.findIndex((p) => p.piece === piece && p.square === square);
  if (idx === -1) return { ok: false, remaining: pending };
  return { ok: true, remaining: pending.filter((_, i) => i !== idx) };
}

/** Yerleştirilecek taş kalmadı mı? */
export function allPlaced(pending: PiecePlacement[]): boolean {
  return pending.length === 0;
}
