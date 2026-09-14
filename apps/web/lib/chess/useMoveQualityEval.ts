'use client';
import { useEffect, useRef, useState } from 'react';
import { StockfishEngine } from './stockfish';
import { scoreForWhite } from './analysisFormat';
import type { WhiteScore } from './moveQuality';

/** Madde 2026-09-05 (3): AnalysisBoard'un etkileşimli analizinden (o an
 *  görüntülenen pozisyonu 3 hatla) BAĞIMSIZ, tek hatlı ayarlar — bu hook
 *  arka planda TÜM geçmişi sırayla değerlendirir. Madde 2026-09-05 (motor
 *  yükseltmesi): NNUE'li motor aynı sürede daha derin/isabetli sonuç
 *  verdiği için derinlik/süre artırıldı (14/400ms → 18/800ms).
 *  Madde 2026-09-14 (3b): Zafer'in onayladığı doğruluk düzeltmesi — çoklu
 *  çekirdek (stockfish.ts) + bu artış birlikte gerçek derinliği yükseltir;
 *  motor daha az hata kaçırır (18/800ms → 22/2500ms). Tek-thread yedek
 *  moda düşen tarayıcılarda da zarar vermez, sadece üst sınıra kadar
 *  bekler. Tam maç analizinin ~2-3 dakikada bitmesi hedeflendi (Zafer'e
 *  önceden bildirilen tahmin) — gerçek cihazda ölçülüp ince ayar yapılabilir. */
const EVAL_DEPTH = 22;
const EVAL_MOVETIME_MS = 2500;

export interface EvalMove {
  ply: number;
  fenAfter: string;
}

interface Result {
  /** 0 = başlangıç konumu, N = N. hamleden sonraki pozisyon — HEP Beyaz açısından. */
  evalByPly: Record<number, WhiteScore>;
  /** Madde 2026-09-14 (3c): O POZİSYONDA (ply-1 → ply arasında OYNANMADAN
   *  önceki konumda) motorun önerdiği en iyi hamle (UCI, örn. "e2e4") —
   *  "Hatalarını Gözden Geçir" egzersizlerinin çözümü için. Key: ply-1
   *  (yani evalByPly[ply-1] ile AYNI pozisyonun en iyi hamlesi). */
  bestMoveByPly: Record<number, string>;
  /** Şu ana kadar değerlendirilen ply sayısı / toplam ply sayısı (ilerleme göstergesi için). */
  progress: { done: number; total: number };
}

/**
 * `baseFen` (ply 0) ve `moves` (ply 1..N, her biri kendi fenAfter'ı) için
 * TÜM pozisyonları arka planda sırayla (paralel DEĞİL) değerlendirir.
 * `moves` her değiştiğinde: eksik ply'lar sıraya eklenir, `moves.length`'ten
 * UZUN kalan eski key'ler (hamle silme/dallanma) hemen budanır — ply
 * numaraları yeniden kullanıldığı için eski bir skorun yeni pozisyona
 * yapışıp kalmasını önler. Kendi AYRI StockfishEngine örneğini tutar.
 */
/** `enabled=false` iken hiçbir motor işi yapılmaz (ör. henüz bir maç/oturum
 *  seçilmemişken gereksiz analiz başlatılmasın diye). */
export function useMoveQualityEval(baseFen: string, moves: EvalMove[], enabled: boolean = true): Result {
  const [evalByPly, setEvalByPly] = useState<Record<number, WhiteScore>>({});
  const [bestMoveByPly, setBestMoveByPly] = useState<Record<number, string>>({});
  const engineRef = useRef<StockfishEngine | null>(null);
  const generationRef = useRef(0);

  useEffect(() => () => { engineRef.current?.destroy(); }, []);

  useEffect(() => {
    if (!enabled) return;
    const generation = ++generationRef.current;

    // Hamle silme/dallanma sonrası: moves.length'ten uzun kalan eski key'ler
    // hemen budanır (ply numaraları yeniden kullanılabildiği için). Budanacak
    // bir şey yoksa AYNI referans döner — React gereksiz yeniden render
    // yapmaz (bu effect `moves` referansı her render'da değişebildiği için
    // sık tetiklenebilir, o yüzden no-op'ta re-render'ı ÇOĞALTMAMAK önemli).
    setEvalByPly((prev) => {
      const staleKeys = Object.keys(prev).map(Number).filter((ply) => ply > moves.length);
      if (staleKeys.length === 0) return prev;
      const next = { ...prev };
      for (const ply of staleKeys) delete next[ply];
      return next;
    });
    setBestMoveByPly((prev) => {
      const staleKeys = Object.keys(prev).map(Number).filter((ply) => ply > moves.length);
      if (staleKeys.length === 0) return prev;
      const next = { ...prev };
      for (const ply of staleKeys) delete next[ply];
      return next;
    });

    async function run() {
      if (!engineRef.current) {
        const eng = new StockfishEngine();
        await eng.init();
        eng.setSkill(20);
        engineRef.current = eng;
      }
      const engine = engineRef.current;

      for (let ply = 0; ply <= moves.length; ply++) {
        if (generation !== generationRef.current) return;
        // Zaten hesaplanmışsa (aynı prefix korunduysa) tekrar analiz edilmez.
        let already = false;
        setEvalByPly((prev) => { already = ply in prev; return prev; });
        if (already) continue;

        const fen = ply === 0 ? baseFen : moves[ply - 1].fenAfter;
        const sideToMove: 'w' | 'b' = fen.split(' ')[1] === 'b' ? 'b' : 'w';
        const candidates = await engine.analyzeMultiPv(fen, EVAL_DEPTH, 1, EVAL_MOVETIME_MS);
        if (generation !== generationRef.current) return;

        const best = candidates[0];
        const white = scoreForWhite(best?.scoreCp ?? null, best?.mate ?? null, sideToMove);
        setEvalByPly((prev) => ({ ...prev, [ply]: white }));
        if (best?.moveUci) {
          setBestMoveByPly((prev) => ({ ...prev, [ply]: best.moveUci }));
        }
      }
    }

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFen, moves, enabled]);

  const done = Object.keys(evalByPly).length;
  return { evalByPly, bestMoveByPly, progress: { done, total: moves.length + 1 } };
}
