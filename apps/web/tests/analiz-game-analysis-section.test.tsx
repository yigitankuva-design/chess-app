import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/components/analiz/AnalysisBoard', () => ({
  AnalysisBoard: ({ fen, boardOrientation }: { fen: string; boardOrientation?: string }) => (
    <div data-testid="analysis-board" data-fen={fen} data-orientation={boardOrientation} />
  ),
}));

const listMyGames = vi.fn();
const getGameMoves = vi.fn();
vi.mock('@/lib/analiz/analizApi', () => ({
  listMyGames: (...args: unknown[]) => listMyGames(...args),
  getGameMoves: (...args: unknown[]) => getGameMoves(...args),
}));

import { GameAnalysisSection } from '@/components/analiz/GameAnalysisSection';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const GAMES = [
  {
    id: 7, type: 'bot' as const, result: '1-0' as const, student_color: 'w' as const,
    started_at: '2026-08-30T10:00:00', finished_at: '2026-08-30T10:20:00',
    opponent: { type: 'bot' as const, level: 4 }, start_fen: null,
  },
];
const MOVES = [
  { ply: 1, san: 'e4', fen_after: 'FEN_AFTER_E4' },
  { ply: 2, san: 'e5', fen_after: 'FEN_AFTER_E5' },
];

describe('GameAnalysisSection', () => {
  it('mount olunca maç listesi çekilir ve gösterilir', async () => {
    listMyGames.mockResolvedValue(GAMES);
    render(<GameAnalysisSection />);
    expect(await screen.findByText('Bot · Düzey 4')).toBeInTheDocument();
  });

  it('bir maç seçilince hamleler çekilir, AnalysisBoard başlangıç konumuyla açılır', async () => {
    listMyGames.mockResolvedValue(GAMES);
    getGameMoves.mockResolvedValue(MOVES);
    render(<GameAnalysisSection />);
    fireEvent.click(await screen.findByText('Bot · Düzey 4'));

    await waitFor(() => expect(getGameMoves).toHaveBeenCalledWith(7));
    expect(await screen.findByTestId('analysis-board')).toHaveAttribute('data-fen', START_FEN);
  });

  it('bir hamleye tıklayınca AnalysisBoard o hamlenin fen_after\'ıyla güncellenir', async () => {
    listMyGames.mockResolvedValue(GAMES);
    getGameMoves.mockResolvedValue(MOVES);
    render(<GameAnalysisSection />);
    fireEvent.click(await screen.findByText('Bot · Düzey 4'));
    await screen.findByTestId('analysis-board');

    fireEvent.click(screen.getByText('e5'));
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-fen', 'FEN_AFTER_E5');
  });

  it('"Maç listesine dön" ile listeye geri döner', async () => {
    listMyGames.mockResolvedValue(GAMES);
    getGameMoves.mockResolvedValue(MOVES);
    render(<GameAnalysisSection />);
    fireEvent.click(await screen.findByText('Bot · Düzey 4'));
    await screen.findByTestId('analysis-board');

    fireEvent.click(screen.getByText('← Maç listesine dön'));
    expect(await screen.findByText('Bot · Düzey 4')).toBeInTheDocument();
    expect(screen.queryByTestId('analysis-board')).not.toBeInTheDocument();
  });

  it('geçmiş boşsa bilgi mesajı gösterir', async () => {
    listMyGames.mockResolvedValue([]);
    render(<GameAnalysisSection />);
    expect(await screen.findByText('Henüz bitmiş bir maçın yok.')).toBeInTheDocument();
  });
});
