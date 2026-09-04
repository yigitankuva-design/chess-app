/**
 * Madde 2026-09-06 (7): Analiz ekranlarında (Yeni Analiz / Maçlarımın
 * Analizi) ana hamle yerine denenen TEK SEVİYELİ bir alternatif devamı
 * (varyant) — Lichess'in dallanma KAVRAMINDAN esinlenilmiş, ama kod ve
 * tasarım tamamen kendimize özgü, kopya değil (Zafer'in telif kuralı).
 *
 * "Tek seviyeli": bir varyantın kendi alt-varyantı OLMAZ — sınırsız iç içe
 * dallanma yerine basit, bir seviyelik bir sapma desteklenir.
 */

export interface PlayedMove {
  ply: number;
  san: string;
  fenAfter: string;
  /** Bu hamle yerine denenen alternatif devam (varsa). */
  variant?: PlayedMove[];
}

export interface ActiveVariant {
  /** Alternatifin bağlı olduğu ANA HAT ply'ı — history[atPly-1] YERİNE bu denendi. */
  atPly: number;
  /** Varyant içindeki konum: 0 = dallanma noktası (henüz varyant hamlesi
   *  yok), N = variant[N-1]'in fenAfter'ı. */
  index: number;
}

/** O an tahtada gösterilmesi gereken FEN. */
export function currentFen(
  startFen: string,
  history: PlayedMove[],
  viewIndex: number,
  activeVariant: ActiveVariant | null,
): string {
  if (!activeVariant) {
    return viewIndex > 0 ? history[viewIndex - 1].fenAfter : startFen;
  }
  const variant = history[activeVariant.atPly - 1]?.variant ?? [];
  if (activeVariant.index > 0) return variant[activeVariant.index - 1]?.fenAfter ?? startFen;
  // index 0 → dallanma noktasının BİR ÖNCESİ (ana hattaki (atPly-1). hamleden sonrası).
  return activeVariant.atPly > 1 ? history[activeVariant.atPly - 2].fenAfter : startFen;
}

/**
 * Tahtada yeni bir hamle oynanınca çağrılır. Ana hatta, henüz oynanmış bir
 * ply'da (viewIndex < history.length) FARKLI bir hamle denenirse — eski
 * "sonrasını sil" davranışı YERİNE — bu ply'a bir varyant EKLENİR, ana hat
 * DOKUNULMAZ. Varyant içindeyken oynanan hamleler o varyantın İÇİNDE
 * (tek seviye) ilerler/dallanır (eski yıkıcı-üzerine-yazma davranışı orada
 * hâlâ geçerlidir — çünkü varyantın kendi alt-varyantı desteklenmiyor).
 */
export function applyMove(
  history: PlayedMove[],
  viewIndex: number,
  activeVariant: ActiveVariant | null,
  played: { san: string; fenAfter: string },
): { history: PlayedMove[]; viewIndex: number; activeVariant: ActiveVariant | null } {
  if (!activeVariant) {
    // Ana hattın SONUNDAYIZ — sıradan yeni hamle, dallanma söz konusu değil.
    if (viewIndex >= history.length) {
      const next = [...history, { ply: viewIndex + 1, san: played.san, fenAfter: played.fenAfter }];
      return { history: next, viewIndex: viewIndex + 1, activeVariant: null };
    }
    const mainMove = history[viewIndex];
    if (mainMove.san === played.san) {
      // Kayıtlı ana hamlenin AYNISI tekrar oynandı — sadece ilerle, dallanma YOK.
      return { history, viewIndex: viewIndex + 1, activeVariant: null };
    }
    // Farklı bir hamle — bu ply'a varyant olarak eklenir, ana hat SİLİNMEZ.
    const atPly = viewIndex + 1;
    const nextHistory = history.map((m, i) =>
      i === viewIndex
        ? { ...m, variant: [{ ply: 1, san: played.san, fenAfter: played.fenAfter }] }
        : m);
    return { history: nextHistory, viewIndex, activeVariant: { atPly, index: 1 } };
  }

  // Varyant İÇİNDEYİZ — tek seviye: burada dallanma yok, eski yıkıcı-devam
  // (üzerine yazma) mantığı geçerli.
  const mainIdx = activeVariant.atPly - 1;
  const variant = history[mainIdx]?.variant ?? [];
  const kept = variant.slice(0, activeVariant.index);
  const nextVariant = [...kept, { ply: kept.length + 1, san: played.san, fenAfter: played.fenAfter }];
  const nextHistory = history.map((m, i) => (i === mainIdx ? { ...m, variant: nextVariant } : m));
  return { history: nextHistory, viewIndex, activeVariant: { atPly: activeVariant.atPly, index: nextVariant.length } };
}

/** Fare tekerleği ile ileri/geri. Varyant içindeyken sınırın altına inilirse
 *  dallanma noktasına (ana hattaki bir önceki ply'a) çıkılır — varyantın
 *  kendi devamı olmadığı için yukarı sınır varyant uzunluğunda kalır. */
export function stepView(
  history: PlayedMove[],
  viewIndex: number,
  activeVariant: ActiveVariant | null,
  delta: 1 | -1,
): { viewIndex: number; activeVariant: ActiveVariant | null } {
  if (!activeVariant) {
    return { viewIndex: Math.max(0, Math.min(history.length, viewIndex + delta)), activeVariant: null };
  }
  const variant = history[activeVariant.atPly - 1]?.variant ?? [];
  const nextIndex = activeVariant.index + delta;
  if (nextIndex < 0) {
    return { viewIndex: activeVariant.atPly - 1, activeVariant: null };
  }
  return {
    viewIndex,
    activeVariant: { atPly: activeVariant.atPly, index: Math.min(variant.length, nextIndex) },
  };
}
