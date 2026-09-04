'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Square } from 'chess.js';
import { Chess } from 'chess.js';
import { listMyGames, getGameMoves } from '@/lib/analiz/analizApi';
import type { GameSummary } from '@/lib/analiz/analizApi';
import { GameHistoryList } from './GameHistoryList';
import { GameMoveList } from './GameMoveList';
import { AnalysisBoard, ANALYSIS_BOARD_MAX_WIDTH } from './AnalysisBoard';
import { useMoveQualityEval } from '@/lib/chess/useMoveQualityEval';
import { applyMove, currentFen, stepView } from '@/lib/chess/variantMoves';
import type { PlayedMove, ActiveVariant } from '@/lib/chess/variantMoves';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface Props {
  /** Madde 2026-09-03 (2): BotGame'in "Analiz Et" özet kartındaki
   *  "Hatalarını Gözden Geçir" CTA'sından gelinince, listeye bakmadan
   *  DOĞRUDAN bu maç açılır. Liste yüklendiğinde bulunamazsa (silinmiş/başka
   *  sporcu) sessizce normal listeye düşer. */
  initialGameId?: number | null;
}

/**
 * Hızlı Erişim "Analiz Et" alt sekmeleri — hem "Yeni Analiz" hem "Maçlarımın
 * Analizi" AYNI tasarımı/bileşeni kullanır (madde 2026-09-01): bitmiş maçlar
 * listelenir, biri seçilince hamle hamle geri/ileri gidip her pozisyonda
 * otomatik motor analizi gösterilir. Kendi içinde bağımsız state taşır —
 * ebeveyn akordiyon kapanıp yeniden açıldığında (unmount/mount) baştan başlar.
 */
export function GameAnalysisSection({ initialGameId = null }: Props = {}) {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<GameSummary | null>(null);
  const [history, setHistory] = useState<PlayedMove[]>([]);
  const [ply, setPly] = useState(0);
  const [activeVariant, setActiveVariant] = useState<ActiveVariant | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [hideNotation, setHideNotation] = useState(false);

  useEffect(() => {
    listMyGames().then((g) => {
      setGames(g);
      setLoading(false);
      const target = initialGameId != null ? g.find((game) => game.id === initialGameId) : undefined;
      if (target) void selectGame(target);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGameId]);

  async function selectGame(g: GameSummary) {
    setSelectedGame(g);
    setPly(0);
    setActiveVariant(null);
    setOrientation('white');
    const moves = await getGameMoves(g.id);
    setHistory(moves.map((m) => ({ ply: m.ply, san: m.san, fenAfter: m.fen_after })));
  }

  const baseFen = selectedGame?.start_fen ?? START_FEN;
  /** Madde 2026-09-05 (3): hamle kalitesi işaretleri — SADECE kayıtlı ana hat
   *  üzerinden hesaplanır (varyant hamleleri kapsam dışı). React hook
   *  kuralları gereği erken return'den ÖNCE, koşulsuz çağrılır. */
  const evalMoves = useMemo(
    () => history.map((m) => ({ ply: m.ply, fenAfter: m.fenAfter })),
    [history],
  );
  const { evalByPly, progress } = useMoveQualityEval(baseFen, evalMoves, !!selectedGame);

  if (!selectedGame) {
    return <GameHistoryList games={games} loading={loading} onSelect={selectGame} />;
  }

  const fen = currentFen(baseFen, history, ply, activeVariant);

  /** Madde 2026-09-06 (7): kayıtlı maçı incelerken ana hamle yerine farklı
   *  bir hamle denenirse artık SONRASI SİLİNMEZ — o ply'a tek seviyeli bir
   *  varyant olarak eklenir (bkz. lib/chess/variantMoves.ts). Sporcunun
   *  KAYITLI maçı (backend) hiçbir zaman değişmez, sadece bu analiz
   *  oturumunun yerel state'i. */
  function handlePieceDrop(from: Square, to: Square): boolean {
    try {
      const board = new Chess(fen);
      const mv = board.move({ from, to, promotion: 'q' });
      if (!mv) return false;
      const r = applyMove(history, ply, activeVariant, { san: mv.san, fenAfter: board.fen() });
      setHistory(r.history);
      setPly(r.viewIndex);
      setActiveVariant(r.activeVariant);
      return true;
    } catch {
      return false;
    }
  }

  /** Madde 2026-09-05 (2): tahta üzerinde fare tekerleği ile hamle geçmişinde
   *  ileri/geri gidilir — 0..history.length arasında sınırlanır. */
  function handleWheelStep(delta: 1 | -1) {
    const r = stepView(history, ply, activeVariant, delta);
    setPly(r.viewIndex);
    setActiveVariant(r.activeVariant);
  }

  /** Madde 2026-09-05 (3): sağ tık menüsündeki "Bu Hamleden Sonrasını Sil" —
   *  kullanıcı kararıyla YALNIZCA bu analiz oturumunda geçici bir kırpma;
   *  sporcunun kayıtlı maçı DEĞİŞMEZ (backend'e hiçbir istek atılmaz). */
  function handleDeleteAfter(afterPly: number) {
    setHistory((prev) => prev.filter((m) => m.ply <= afterPly));
    setPly((p) => Math.min(p, afterPly));
    setActiveVariant(null);
  }

  function selectMainPly(nextPly: number) {
    setPly(nextPly);
    setActiveVariant(null);
  }

  function selectVariantPly(atPly: number, index: number) {
    setActiveVariant({ atPly, index });
  }

  return (
    <div className="space-y-3">
      {/* Madde 2026-09-03 (4): ortalanmış (hafif sağa kaymış), okusuz, %20
          büyütülmüş (0.75rem → 0.9rem) — tıklanınca listeye döner. */}
      <div className="flex justify-center" style={{ maxWidth: ANALYSIS_BOARD_MAX_WIDTH }}>
        <button type="button" onClick={() => setSelectedGame(null)} className="t-muted"
          style={{
            fontSize: '0.9rem', marginLeft: '12%',
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          }}>
          Maç listesine dön
        </button>
      </div>
      <AnalysisBoard fen={fen} boardOrientation={orientation}
        interactive onPieceDrop={handlePieceDrop}
        onWheelStep={handleWheelStep} hideNotation={hideNotation} />
      <GameMoveList moves={history} currentPly={ply} onSelectPly={selectMainPly}
        onFlipBoard={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
        hideNotation={hideNotation} onToggleHideNotation={() => setHideNotation((v) => !v)}
        onDeleteAfter={handleDeleteAfter}
        evalByPly={evalByPly} evalProgress={progress}
        activeVariant={activeVariant} onSelectVariantPly={selectVariantPly}
      />
    </div>
  );
}
