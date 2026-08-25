'use client';
import { useEffect, useState } from 'react';
import { listMyGames, getGameMoves } from '@/lib/analiz/analizApi';
import type { GameSummary, GameMoveDto } from '@/lib/analiz/analizApi';
import { GameHistoryList } from './GameHistoryList';
import { GameMoveList } from './GameMoveList';
import { AnalysisBoard } from './AnalysisBoard';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Hızlı Erişim "Analiz Et" alt sekmeleri — hem "Yeni Analiz" hem "Maçlarımın
 * Analizi" AYNI tasarımı/bileşeni kullanır (madde 2026-09-01): bitmiş maçlar
 * listelenir, biri seçilince hamle hamle geri/ileri gidip her pozisyonda
 * otomatik motor analizi gösterilir. Kendi içinde bağımsız state taşır —
 * ebeveyn akordiyon kapanıp yeniden açıldığında (unmount/mount) baştan başlar.
 */
export function GameAnalysisSection() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<GameSummary | null>(null);
  const [moves, setMoves] = useState<GameMoveDto[]>([]);
  const [ply, setPly] = useState(0);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');

  useEffect(() => {
    listMyGames().then((g) => { setGames(g); setLoading(false); });
  }, []);

  async function selectGame(g: GameSummary) {
    setSelectedGame(g);
    setPly(0);
    setOrientation('white');
    setMoves(await getGameMoves(g.id));
  }

  if (!selectedGame) {
    return <GameHistoryList games={games} loading={loading} onSelect={selectGame} />;
  }

  const baseFen = selectedGame.start_fen ?? START_FEN;
  const fen = ply === 0 ? baseFen : (moves[ply - 1]?.fen_after ?? baseFen);

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setSelectedGame(null)} className="text-xs t-muted">
        ← Maç listesine dön
      </button>
      <AnalysisBoard fen={fen} boardOrientation={orientation} />
      <GameMoveList moves={moves} currentPly={ply} onSelectPly={setPly}
        onFlipBoard={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} />
    </div>
  );
}
