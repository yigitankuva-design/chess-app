export type ShapeKind = 'circle' | 'square' | 'rectangle' | 'star' | 'arrow' | 'question';

export interface PaintItemBase {
  id: string;
  x: number;
  y: number;
  rotation: number;
  color: string;
}
export interface TextPaintItem extends PaintItemBase {
  kind: 'text';
  text: string;
  fontSize: number;
}
export interface ShapePaintItem extends PaintItemBase {
  kind: 'shape';
  shape: ShapeKind;
  w: number;
  h: number;
}
export type PaintItem = TextPaintItem | ShapePaintItem;

export const PALETTE: { name: string; color: string }[] = [
  { name: 'Siyah', color: '#000000' },
  { name: 'Beyaz', color: '#ffffff' },
  { name: 'Kırmızı', color: '#ef4444' },
  { name: 'Mavi', color: '#3b82f6' },
  { name: 'Yeşil', color: '#22c55e' },
  { name: 'Mor', color: '#a855f7' },
  { name: 'Turuncu', color: '#f97316' },
  { name: 'Turkuaz', color: '#14b8a6' },
  { name: 'Kahverengi', color: '#92400e' },
  { name: 'Sarı', color: '#eab308' },
];

export const SHAPES: { shape: ShapeKind; label: string }[] = [
  { shape: 'circle', label: 'Daire' },
  { shape: 'square', label: 'Kare' },
  { shape: 'rectangle', label: 'Dikdörtgen' },
  { shape: 'star', label: 'Yıldız' },
  { shape: 'arrow', label: 'Ok' },
  { shape: 'question', label: 'Soru İşareti' },
];

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function clampCoord(v: number): number { return clamp(v, 0, 100); }
export function clampSize(v: number): number { return clamp(v, 2, 90); }
export function clampFontSize(v: number): number { return clamp(v, 12, 72); }
export function clampRotation(v: number): number {
  const m = v % 360;
  return m < 0 ? m + 360 : m;
}

let counter = 0;
export function makeId(): string {
  counter += 1;
  return `p${Date.now()}${counter}`;
}

export function newTextItem(x: number, y: number, color: string): TextPaintItem {
  return { id: makeId(), kind: 'text', x: clampCoord(x), y: clampCoord(y), rotation: 0, color, text: 'Yazı', fontSize: 24 };
}

export function newShapeItem(shape: ShapeKind, x: number, y: number, color: string): ShapePaintItem {
  return { id: makeId(), kind: 'shape', shape, x: clampCoord(x), y: clampCoord(y), rotation: 0, color, w: 15, h: 15 };
}

export function dragItem(item: PaintItem, deltaPxX: number, deltaPxY: number, boxPxW: number, boxPxH: number): PaintItem {
  if (boxPxW <= 0 || boxPxH <= 0) return item;
  return { ...item, x: clampCoord(item.x + (deltaPxX / boxPxW) * 100), y: clampCoord(item.y + (deltaPxY / boxPxH) * 100) };
}

export function resizeItem(item: ShapePaintItem, deltaPxX: number, deltaPxY: number, boxPxW: number, boxPxH: number): ShapePaintItem {
  if (boxPxW <= 0 || boxPxH <= 0) return item;
  return {
    ...item,
    w: clampSize(item.w + (deltaPxX / boxPxW) * 100 * 2),
    h: clampSize(item.h + (deltaPxY / boxPxH) * 100 * 2),
  };
}

/** İşaretçinin merkeze göre açısını hesaplar. Tutamaç merkezin ÜSTÜNDE durduğu
 *  için (0° = yukarı), atan2'nin standart "sağ=0°" çıktısına +90° eklenir. */
export function rotateItem(item: PaintItem, centerPxX: number, centerPxY: number, pointerPxX: number, pointerPxY: number): PaintItem {
  const angleRad = Math.atan2(pointerPxY - centerPxY, pointerPxX - centerPxX);
  const deg = (angleRad * 180) / Math.PI + 90;
  return { ...item, rotation: clampRotation(deg) };
}
