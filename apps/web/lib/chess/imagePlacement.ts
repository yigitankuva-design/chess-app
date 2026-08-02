/** Görselin tahta üzerindeki konumu/boyutu — hepsi tahta genişliği/yüksekliğinin
 *  YÜZDESİ (0-100). x,y = görselin MERKEZİ. w,h = görselin genişlik/yüksekliği. */
export interface ImagePlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0-10 tam sayı — gri tonlama yoğunluğu (0=orijinal, 10=tam gri). */
  tone: number;
}

export const DEFAULT_PLACEMENT: ImagePlacement = { x: 50, y: 50, w: 40, h: 40, tone: 0 };

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Eksik/aralık dışı alanları varsayılanla doldurup sınırlar içine sıkıştırır. */
export function clampPlacement(p: Partial<ImagePlacement>): ImagePlacement {
  return {
    x: clamp(p.x ?? DEFAULT_PLACEMENT.x, 0, 100),
    y: clamp(p.y ?? DEFAULT_PLACEMENT.y, 0, 100),
    w: clamp(p.w ?? DEFAULT_PLACEMENT.w, 5, 90),
    h: clamp(p.h ?? DEFAULT_PLACEMENT.h, 5, 90),
    tone: Math.round(clamp(p.tone ?? DEFAULT_PLACEMENT.tone, 0, 10)),
  };
}

/** Sürükleme: piksel deltasını tahtanın piksel boyutuna göre yüzdeye çevirip
 *  merkez konumuna ekler. Tahta boyutu bilinmiyorsa (0) değiştirmeden döner. */
export function dragToPercent(
  start: ImagePlacement, deltaPxX: number, deltaPxY: number, boardPxW: number, boardPxH: number,
): ImagePlacement {
  if (boardPxW <= 0 || boardPxH <= 0) return start;
  return clampPlacement({
    ...start,
    x: start.x + (deltaPxX / boardPxW) * 100,
    y: start.y + (deltaPxY / boardPxH) * 100,
  });
}

/** Boyutlandırma: tutamaç köşede durur (merkez + yarı boyut). Tutamacı deltaPx
 *  kadar sürüklemek köşeyi o kadar kaydırır, yani YARI genişlik deltaPx kadar
 *  değişir — TAM genişlik bu yüzden 2×deltaPx kadar değişir (merkez sabit kalıp
 *  görsel her iki yöne birden büyür/küçülür). */
export function resizeToPercent(
  start: ImagePlacement, deltaPxX: number, deltaPxY: number, boardPxW: number, boardPxH: number,
): ImagePlacement {
  if (boardPxW <= 0 || boardPxH <= 0) return start;
  return clampPlacement({
    ...start,
    w: start.w + (deltaPxX / boardPxW) * 100 * 2,
    h: start.h + (deltaPxY / boardPxH) * 100 * 2,
  });
}

/** 0-10 tonu CSS grayscale filtresine çevirir. 0 = filtre yok (performans). */
export function toneToFilter(tone: number): string {
  const clamped = Math.round(clamp(tone, 0, 10));
  return clamped === 0 ? 'none' : `grayscale(${clamped / 10})`;
}

/** Çoklu görsel eklerken her yeni görselin varsayılan konumu — üst üste
 *  binmesinler diye indekse göre hafifçe kaydırılır (5 adımda bir tekrar eder). */
export function defaultPlacementForIndex(index: number): ImagePlacement {
  const step = index % 5;
  const offset = step * 8;
  return clampPlacement({
    x: DEFAULT_PLACEMENT.x + offset,
    y: DEFAULT_PLACEMENT.y + offset,
    w: DEFAULT_PLACEMENT.w,
    h: DEFAULT_PLACEMENT.h,
    tone: 0,
  });
}
