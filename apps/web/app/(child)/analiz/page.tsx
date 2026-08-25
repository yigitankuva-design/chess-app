'use client';
import { useEffect, useState } from 'react';
import { useTabGuard } from '@/lib/settings/useTabGuard';
import { useSettings } from '@/lib/settings/settings-context';
import { listMyGames, getGameMoves } from '@/lib/analiz/analizApi';
import type { GameSummary, GameMoveDto } from '@/lib/analiz/analizApi';
import { GameHistoryList } from '@/components/analiz/GameHistoryList';
import { GameMoveList } from '@/components/analiz/GameMoveList';
import { AnalysisBoard } from '@/components/analiz/AnalysisBoard';
import { CustomPositionAnalysis } from '@/components/analiz/CustomPositionAnalysis';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

type Mode = 'games' | 'custom' | null;

const ChevronRight = () => (
  <svg className="flex-shrink-0 t-muted" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} aria-label="Geri"
    className="flex items-center justify-center rounded-full border border-white/15 t-premium flex-shrink-0"
    style={{ width: 36, height: 36, fontSize: '1.35rem', fontWeight: 700 }}>
    ←
  </button>
);

/**
 * Hızlı Erişim "Analiz Et" sekmesi. İki mod:
 * - "Son Maçlarımı İncele": bitmiş maçlar listelenir, biri seçilince hamle
 *   hamle geri/ileri gidip her pozisyonda otomatik motor analizi gösterilir.
 * - "Kendi Konumumu Analiz Et": admin'in "Konumu Analiz Et" giriş deseniyle
 *   sporcu bir konum diz/FEN yapıştırır, elle "Analiz Et"e basar.
 */
export default function AnalizPage() {
  useTabGuard('analiz');
  const { settings } = useSettings();
  const [mode, setMode] = useState<Mode>(null);

  const [games, setGames] = useState<GameSummary[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameSummary | null>(null);
  const [moves, setMoves] = useState<GameMoveDto[]>([]);
  const [ply, setPly] = useState(0);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');

  useEffect(() => {
    if (mode !== 'games' || selectedGame) return;
    setGamesLoading(true);
    listMyGames().then((g) => { setGames(g); setGamesLoading(false); });
  }, [mode, selectedGame]);

  async function selectGame(g: GameSummary) {
    setSelectedGame(g);
    setPly(0);
    setOrientation('white');
    setMoves(await getGameMoves(g.id));
  }

  function backToModeSelect() {
    setMode(null);
    setSelectedGame(null);
    setMoves([]);
  }

  // ── Mod seçimi (2 kart) ──────────────────────────────────────────────────
  if (!mode) {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-3">
        <p className="text-xs font-semibold t-muted uppercase tracking-widest">
          {settings.labels.features.analiz}
        </p>
        <button onClick={() => setMode('games')}
          className="t-card-i w-full flex items-center gap-4 px-4 py-4 text-left">
          <span className="text-2xl">🕹️</span>
          <div className="flex-1">
            <p className="font-semibold text-sm">Son Maçlarımı İncele</p>
            <p className="text-xs t-muted mt-0.5">Geçmiş maçlarını hamle hamle motor analiziyle incele</p>
          </div>
          <ChevronRight />
        </button>
        <button onClick={() => setMode('custom')}
          className="t-card-i w-full flex items-center gap-4 px-4 py-4 text-left">
          <span className="text-2xl">🧩</span>
          <div className="flex-1">
            <p className="font-semibold text-sm">Kendi Konumumu Analiz Et</p>
            <p className="text-xs t-muted mt-0.5">Bir konum diz veya FEN yapıştır, en güçlü motorla incele</p>
          </div>
          <ChevronRight />
        </button>
      </main>
    );
  }

  // ── Kendi Konumumu Analiz Et ─────────────────────────────────────────────
  if (mode === 'custom') {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <BackButton onClick={backToModeSelect} />
          <h1 className="text-xl font-extrabold t-premium">Kendi Konumumu Analiz Et</h1>
        </div>
        <CustomPositionAnalysis />
      </main>
    );
  }

  // ── Son Maçlarımı İncele — maç listesi ───────────────────────────────────
  if (!selectedGame) {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <BackButton onClick={backToModeSelect} />
          <h1 className="text-xl font-extrabold t-premium">Son Maçlarımı İncele</h1>
        </div>
        <GameHistoryList games={games} loading={gamesLoading} onSelect={selectGame} />
      </main>
    );
  }

  // ── Son Maçlarımı İncele — seçili maç incelemesi ─────────────────────────
  const baseFen = selectedGame.start_fen ?? START_FEN;
  const fen = ply === 0 ? baseFen : (moves[ply - 1]?.fen_after ?? baseFen);

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setSelectedGame(null)} />
        <h1 className="text-xl font-extrabold t-premium">Maç İncelemesi</h1>
      </div>
      <AnalysisBoard fen={fen} boardOrientation={orientation} />
      <GameMoveList moves={moves} currentPly={ply} onSelectPly={setPly}
        onFlipBoard={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} />
    </main>
  );
}
