'use client';
import { useCallback, useState } from 'react';
import { clampViewIndex } from '@/lib/play/moveNavigation';

export interface MoveHistoryNav {
  /** Tahtada gösterilen yarı-hamle sırası (0 = başlangıç konumu). */
  viewIndex: number;
  /** Son (canlı) konumda mıyız? */
  isLive: boolean;
  /** Gösterilecek FEN. */
  viewFen: string;
  /** Belirli bir sıraya atlar. */
  goTo: (index: number) => void;
  /** Canlı konuma döner. */
  goLive: () => void;
  /** İleri (+1) / geri (-1) tek adım. Tekerlek buna bağlanır. */
  step: (delta: number) => void;
}

/**
 * Hamle geçmişinde gezinme durumu (madde 1). SALT OKUNUR: hiçbir hamleyi
 * geri almaz, değiştirmez — yalnız hangi konumun gösterileceğini söyler.
 *
 * Durum `number | null` tutulur: `null` "canlıyı takip et" demektir. Böylece
 * yeni hamle geldiğinde canlıdaki sporcu otomatik ilerler, geçmişe bakan
 * sporcu ise BULUNDUĞU YERDE KALIR (kullanıcı kararı).
 */
export function useMoveHistoryNav(fens: string[]): MoveHistoryNav {
  const [pinned, setPinned] = useState<number | null>(null);

  const last = Math.max(fens.length - 1, 0);
  // Clamp HER OKUMADA uygulanir: liste kisalsa bile sira disari tasmaz.
  const viewIndex = pinned === null ? last : clampViewIndex(pinned, fens.length);
  const isLive = viewIndex === last;

  const goTo = useCallback((index: number) => setPinned(index), []);
  const goLive = useCallback(() => setPinned(null), []);

  const step = useCallback((delta: number) => {
    setPinned((prev) => {
      const current = prev === null ? Math.max(fens.length - 1, 0) : prev;
      const next = clampViewIndex(current + delta, fens.length);
      // Son konuma gelindiyse tekrar CANLIYI TAKIP moduna geç.
      return next >= fens.length - 1 ? null : next;
    });
  }, [fens.length]);

  return { viewIndex, isLive, viewFen: fens[viewIndex], goTo, goLive, step };
}
