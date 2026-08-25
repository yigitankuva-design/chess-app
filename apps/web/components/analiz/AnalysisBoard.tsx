'use client';
import { useEffect, useRef, useState } from 'react';
import type { Square } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { EvalBar } from './EvalBar';
import { CandidateLines } from './CandidateLines';
import type { CandidateLine } from './CandidateLines';
import { StockfishEngine } from '@/lib/chess/stockfish';
import { pvUciToSan, formatContinuation, scoreForWhite } from '@/lib/chess/analysisFormat';

/** Tahta + eval bar + 3 aday hamle panelinin oturduğu sabit genişlik. */
export const ANALYSIS_BOARD_MAX_WIDTH = 380;

// Madde 2026-08-30/31 (1): derinlik 20 → 14, ayrıca bir süre sınırı (movetime)
// eklendi — MultiPV=3 ile derinlik tek başına yeterince hızlı olmuyordu
// (karmaşık pozisyonlarda arama uzayabiliyordu). Motor artık hangisi önce
// gelirse (derinlik veya süre) onda durur. Skill YİNE 20 (en güçlü hamle
// seçimi), sadece arama süresi/derinliği kısıtlandı.
const ANALYSIS_DEPTH = 14;
const ANALYSIS_MOVETIME_MS = 700;
const MULTI_PV = 3;
// Madde 2026-08-30 (2): her aday hattın devamı en fazla 4 hamle (ply) gösterilir.
const CONTINUATION_PLIES = 4;

interface Props {
  fen: string;
  /** Madde 2026-08-30 (3): "Tahtayı çevir" butonuyla değiştirilir. */
  boardOrientation?: 'white' | 'black';
}

/**
 * Analiz Et sekmesi — hem "Son Maçlarımı İncele" (fen her ply'de değişir) hem
 * "Kendi Konumumu Analiz Et" (fen sabittir, tek seferlik) için ORTAK panel.
 * `fen` prop'u her değiştiğinde (mount dahil) motor EN GÜÇLÜ seviyede
 * (Skill 20, Depth 14) 3 aday hamleyi otomatik yeniden hesaplar — ayrı bir
 * "otomatik/elle" anahtarı YOK, çağıran taraf ne zaman bu bileşeni monte
 * edeceğine/fen'i değiştireceğine karar vererek tetikleme şeklini belirler.
 */
export function AnalysisBoard({ fen, boardOrientation = 'white' }: Props) {
  const engineRef = useRef<StockfishEngine | null>(null);
  const requestIdRef = useRef(0);
  const [lines, setLines] = useState<CandidateLine[]>([]);
  const [scoreCp, setScoreCp] = useState<number | null>(null);
  const [mate, setMate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => { engineRef.current?.destroy(); }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    async function run() {
      if (!engineRef.current) {
        const eng = new StockfishEngine();
        await eng.init();
        eng.setSkill(20);
        engineRef.current = eng;
      }
      // Yarış koşulu koruması: motor isteği İPTAL edilemez (StockfishEngine'de
      // cancel yok) — fen hızlıca değişirse (ör. hamle listesinde ileri/geri)
      // eski isteğin sonucu YENİ fen üzerine yazmasın.
      const candidates = await engineRef.current.analyzeMultiPv(
        fen, ANALYSIS_DEPTH, MULTI_PV, ANALYSIS_MOVETIME_MS,
      );
      if (requestId !== requestIdRef.current) return;

      const sideToMove: 'w' | 'b' = fen.split(' ')[1] === 'b' ? 'b' : 'w';
      const nextLines: CandidateLine[] = candidates.map((c) => {
        const white = scoreForWhite(c.scoreCp, c.mate, sideToMove);
        const san = pvUciToSan(fen, c.pvUci.slice(0, CONTINUATION_PLIES));
        return { scoreCp: white.cp, mate: white.mate, continuation: formatContinuation(fen, san) };
      });
      setLines(nextLines);
      setScoreCp(nextLines[0]?.scoreCp ?? null);
      setMate(nextLines[0]?.mate ?? null);
      setLoading(false);
    }

    run();
  }, [fen]);

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2" style={{ maxWidth: ANALYSIS_BOARD_MAX_WIDTH }}>
        <EvalBar scoreCp={scoreCp} mate={mate} />
        <div style={{ width: '100%' }}>
          <ChessBoard fen={fen} highlightSquares={[] as Square[]}
            boardOrientation={boardOrientation} />
        </div>
      </div>
      <div style={{ maxWidth: ANALYSIS_BOARD_MAX_WIDTH }}>
        <CandidateLines lines={lines} depth={ANALYSIS_DEPTH} loading={loading} />
      </div>
    </div>
  );
}
