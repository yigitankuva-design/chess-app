'use client';
import { useEffect, useRef, useState } from 'react';
import { StockfishEngine } from './stockfish';
import { scoreForWhite } from './analysisFormat';
import type { WhiteScore } from './moveQuality';

/** Madde 2026-09-05 (3): AnalysisBoard'un etkileşimli analizinden (o an
 *  görüntülenen pozisyonu 3 hatla) BAĞIMSIZ, tek hatlı ayarlar — bu hook
 *  arka planda TÜM geçmişi sırayla değerlendirir. Madde 2026-09-05 (motor
 *  yükseltmesi): NNUE'li motor aynı sürede daha derin/isabetli sonuç
 *  verdiği için derinlik/süre artırıldı (14/400ms → 18/800ms). */
const EVAL_DEPTH = 18;
const EVAL_MOVETIME_MS = 800;

export interface EvalMove {
  ply: number;
  fenAfter: string;
}

interface Result {
  /** 0 = başlangıç konumu, N = N. hamleden sonraki pozisyon — HEP Beyaz açısından. */
  evalByPly: Record<number, WhiteScore>;
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
      }
    }

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFen, moves, enabled]);

  const done = Object.keys(evalByPly).length;
  return { evalByPly, progress: { done, total: moves.length + 1 } };
}
