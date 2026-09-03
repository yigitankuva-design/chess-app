/**
 * "Analiz Et" özet kartı — madde 2026-09-03 (2). Bota karşı biten bir maçın
 * SADECE sporcunun kendi hamleleri üzerinden özetini çıkarır (botun hataları
 * kart dışıdır — amaç sporcuyu öğretmek).
 *
 * Zafer'in gönderdiği görsel Lichess'ten alınmıştı; kullanılan formüller
 * (kazanma-yüzdesi eğrisi, hamle doğruluğu, inaccuracy/mistake/blunder cp
 * eşikleri) KAMUYA AÇIK, yaygın bilinen yöntemlerdir — Zafer'e kaynaklarıyla
 * raporlandı. Tasarım (`MatchAnalysisSummary.tsx`) kendi neumorphic dilimizle
 * ayrıca çizilir; buradaki hesap KOD olarak hiçbir yerden kopyalanmadı.
 *
 * Açılış/Oyunortası/Oyunsonu ayrımı Lichess'in TAM algoritmasıyla BİREBİR
 * aynı sayıyı vermeyebilir (o algoritma kamuya açık değil) — burada basit,
 * şeffaf bir sezgisel kural kullanılır (bkz. `gamePhase`).
 */
import type { WhiteScore } from './moveQuality';

export type Phase = 'opening' | 'middlegame' | 'endgame';

export interface PhaseAccuracy {
  opening: number | null;
  middlegame: number | null;
  endgame: number | null;
}

export interface GameSummary {
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  /** Ortalama santipiyon kaybı — HAM cp biriminde (Lichess'teki gösterimle
   *  AYNI, 100'e bölünmez). Sporcunun hiç hamlesi yoksa null. */
  acpl: number | null;
  /** 0-100 doğruluk yüzdesi. Sporcunun hiç hamlesi yoksa null. */
  accuracy: number | null;
  phaseAccuracy: PhaseAccuracy;
}

const INACCURACY_CP = 50;
const MISTAKE_CP = 100;
const BLUNDER_CP = 300;

/** Mat skorunu eşik mantığının tek tip çalışması için büyük bir centipawn
 *  değerine çevirir — `moveQuality.ts`'teki AYNI teknik, bağımsız kopyası
 *  (o modüle bağımlılık kurmamak için — plan gereği). */
const MATE_BASE_CP = 100_000;
function mateToCp(mate: number): number {
  return Math.sign(mate) * (MATE_BASE_CP - Math.abs(mate) * 100);
}
function effectiveCp(score: WhiteScore): number | null {
  if (score.mate !== null) return mateToCp(score.mate);
  return score.cp;
}

/** Beyaz açısından cp'yi verilen tarafın açısına çevirir. */
function forSide(cpWhite: number, side: 'w' | 'b'): number {
  return side === 'w' ? cpWhite : -cpWhite;
}

/** Lichess'in kamuya açık kazanma-yüzdesi formülü (madde: araştırma
 *  sonucu Zafer'e raporlandı). cp: bir tarafın kendi açısından skoru. */
export function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Bir hamlenin kaybettirdiği kazanma yüzdesine göre 0-100 doğruluk puanı
 *  (yaygın kullanılan yaklaşık formül). */
export function moveAccuracyFromWinDrop(winPctDrop: number): number {
  const drop = Math.max(0, winPctDrop);
  const acc = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
  return Math.min(100, Math.max(0, acc));
}

export function classifyDelta(cpLoss: number): 'inaccuracy' | 'mistake' | 'blunder' | null {
  if (cpLoss >= BLUNDER_CP) return 'blunder';
  if (cpLoss >= MISTAKE_CP) return 'mistake';
  if (cpLoss >= INACCURACY_CP) return 'inaccuracy';
  return null;
}

/** Taş sayısına dayalı basit faz sezgisi — bkz. modül üstü not. */
const OPENING_PLY_LIMIT = 20; // ilk 10 tam hamle (her iki taraf)
const ENDGAME_MATERIAL_THRESHOLD = 13; // toplam piyon-dışı malzeme (iki taraf)
const PIECE_VALUE: Record<string, number> = { n: 3, b: 3, r: 5, q: 9 };

function nonPawnMaterial(fen: string): number {
  const board = fen.trim().split(/\s+/)[0] ?? '';
  let total = 0;
  for (const ch of board) {
    const v = PIECE_VALUE[ch.toLowerCase()];
    if (v !== undefined) total += v;
  }
  return total;
}

export function gamePhase(ply: number, fenAfter: string): Phase {
  if (ply <= OPENING_PLY_LIMIT) return 'opening';
  if (nonPawnMaterial(fenAfter) <= ENDGAME_MATERIAL_THRESHOLD) return 'endgame';
  return 'middlegame';
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * `evalByPly`: `useMoveQualityEval`'den gelen, HER ply için Beyaz açısından
 * skor (ply 0 = başlangıç). `fens`: `fensFromSan`'den gelen, AYNI indekste
 * FEN dizisi (uzunluk evalByPly ile aynı olmalı — eksik ply'lar atlanır,
 * motor henüz o kadarını değerlendirmemiş olabilir). `studentColor`:
 * sporcunun rengi — sadece bu renkteki hamleler sayılır.
 */
export function computeGameSummary(
  evalByPly: Record<number, WhiteScore>,
  fens: string[],
  studentColor: 'w' | 'b',
): GameSummary {
  const startTurn: 'w' | 'b' = (fens[0]?.split(/\s+/)[1] === 'b') ? 'b' : 'w';

  let inaccuracies = 0, mistakes = 0, blunders = 0;
  const cpLosses: number[] = [];
  const moveAccs: number[] = [];
  const byPhase: Record<Phase, number[]> = { opening: [], middlegame: [], endgame: [] };

  for (let ply = 1; ply < fens.length; ply++) {
    const mover: 'w' | 'b' = (ply % 2 === 1) ? startTurn : (startTurn === 'w' ? 'b' : 'w');
    if (mover !== studentColor) continue;

    const before = evalByPly[ply - 1];
    const after = evalByPly[ply];
    if (!before || !after) continue; // motor henüz bu ply'a ulaşmadı

    const beforeCp = effectiveCp(before);
    const afterCp = effectiveCp(after);
    if (beforeCp === null || afterCp === null) continue;

    // Sporcu açısına çevir — kayıp HER ZAMAN sporcunun pozisyonu kötüleşince pozitif olsun.
    const beforeForStudent = forSide(beforeCp, studentColor);
    const afterForStudent = forSide(afterCp, studentColor);
    const cpLoss = Math.max(0, beforeForStudent - afterForStudent);
    cpLosses.push(cpLoss);

    const kind = classifyDelta(cpLoss);
    if (kind === 'inaccuracy') inaccuracies++;
    else if (kind === 'mistake') mistakes++;
    else if (kind === 'blunder') blunders++;

    const winBefore = winPercent(beforeForStudent);
    const winAfter = winPercent(afterForStudent);
    const acc = moveAccuracyFromWinDrop(winBefore - winAfter);
    moveAccs.push(acc);

    const fenAfter = fens[ply];
    if (fenAfter) byPhase[gamePhase(ply, fenAfter)].push(acc);
  }

  const acplAvg = average(cpLosses);
  return {
    inaccuracies,
    mistakes,
    blunders,
    acpl: acplAvg === null ? null : Math.round(acplAvg),
    accuracy: average(moveAccs),
    phaseAccuracy: {
      opening: average(byPhase.opening),
      middlegame: average(byPhase.middlegame),
      endgame: average(byPhase.endgame),
    },
  };
}
