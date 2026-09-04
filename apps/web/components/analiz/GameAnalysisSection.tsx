'use client';
import { useEffect, useMemo, useState } from 'react';
import { listMyGames, getGameMoves } from '@/lib/analiz/analizApi';
import type { GameSummary, GameMoveDto } from '@/lib/analiz/analizApi';
import { GameHistoryList } from './GameHistoryList';
import { GameMoveList } from './GameMoveList';
import { AnalysisBoard, ANALYSIS_BOARD_MAX_WIDTH } from './AnalysisBoard';
import { useMoveQualityEval } from '@/lib/chess/useMoveQualityEval';

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
  const [moves, setMoves] = useState<GameMoveDto[]>([]);
  const [ply, setPly] = useState(0);
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
    setOrientation('white');
    setMoves(await getGameMoves(g.id));
  }

  const baseFen = selectedGame?.start_fen ?? START_FEN;
  /** Madde 2026-09-05 (3): hamle kalitesi işaretleri — maç seçilince arka
   *  planda TÜM hamleler baştan değerlendirilir (React hook kuralları
   *  gereği erken return'den ÖNCE, koşulsuz çağrılır). */
  const evalMoves = useMemo(
    () => moves.map((m) => ({ ply: m.ply, fenAfter: m.fen_after })),
    [moves],
  );
  const { evalByPly, progress } = useMoveQualityEval(baseFen, evalMoves, !!selectedGame);

  if (!selectedGame) {
    return <GameHistoryList games={games} loading={loading} onSelect={selectGame} />;
  }

  const fen = ply === 0 ? baseFen : (moves[ply - 1]?.fen_after ?? baseFen);

  /** Madde 2026-09-05 (2): tahta üzerinde fare tekerleği ile hamle geçmişinde
   *  ileri/geri gidilir — 0..moves.length arasında sınırlanır. */
  function handleWheelStep(delta: 1 | -1) {
    setPly((p) => Math.max(0, Math.min(moves.length, p + delta)));
  }

  /** Madde 2026-09-05 (3): sağ tık menüsündeki "Bu Hamleden Sonrasını Sil" —
   *  kullanıcı kararıyla YALNIZCA bu analiz oturumunda geçici bir kırpma;
   *  sporcunun kayıtlı maçı DEĞİŞMEZ (backend'e hiçbir istek atılmaz). */
  function handleDeleteAfter(afterPly: number) {
    setMoves((prev) => prev.filter((m) => m.ply <= afterPly));
    setPly((p) => Math.min(p, afterPly));
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
        onWheelStep={handleWheelStep} hideNotation={hideNotation} />
      <GameMoveList moves={moves} currentPly={ply} onSelectPly={setPly}
        onFlipBoard={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
        hideNotation={hideNotation} onToggleHideNotation={() => setHideNotation((v) => !v)}
        onDeleteAfter={handleDeleteAfter}
        evalByPly={evalByPly} evalProgress={progress}
      />
    </div>
  );
}
