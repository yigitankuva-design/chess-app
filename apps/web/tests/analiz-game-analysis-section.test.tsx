import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/components/analiz/AnalysisBoard', () => ({
  AnalysisBoard: ({
    fen, boardOrientation, onWheelStep, hideNotation,
  }: {
    fen: string; boardOrientation?: string; onWheelStep?: (delta: 1 | -1) => void; hideNotation?: boolean;
  }) => (
    <div data-testid="analysis-board" data-fen={fen} data-orientation={boardOrientation}
      data-hide-notation={hideNotation ? 'true' : 'false'}>
      <button type="button" data-testid="wheel-forward" onClick={() => onWheelStep?.(1)} />
      <button type="button" data-testid="wheel-back" onClick={() => onWheelStep?.(-1)} />
    </div>
  ),
  ANALYSIS_BOARD_MAX_WIDTH: 380,
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

  it('"Maç listesine dön" ile listeye geri döner (madde 2026-09-03 (4): ok işareti YOK)', async () => {
    listMyGames.mockResolvedValue(GAMES);
    getGameMoves.mockResolvedValue(MOVES);
    render(<GameAnalysisSection />);
    fireEvent.click(await screen.findByText('Bot · Düzey 4'));
    await screen.findByTestId('analysis-board');

    expect(screen.queryByText(/←/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Maç listesine dön'));
    expect(await screen.findByText('Bot · Düzey 4')).toBeInTheDocument();
    expect(screen.queryByTestId('analysis-board')).not.toBeInTheDocument();
  });

  it('geçmiş boşsa bilgi mesajı gösterir', async () => {
    listMyGames.mockResolvedValue([]);
    render(<GameAnalysisSection />);
    expect(await screen.findByText('Henüz bitmiş bir maçın yok.')).toBeInTheDocument();
  });
});

describe('GameAnalysisSection — fare tekerleği ile ileri/geri (madde 2026-09-05 (2))', () => {
  it('tekerlek ileri hamle geçmişinde ileri gider', async () => {
    listMyGames.mockResolvedValue(GAMES);
    getGameMoves.mockResolvedValue(MOVES);
    render(<GameAnalysisSection />);
    fireEvent.click(await screen.findByText('Bot · Düzey 4'));
    await screen.findByTestId('analysis-board');

    fireEvent.click(screen.getByTestId('wheel-forward'));
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-fen', 'FEN_AFTER_E4');
    fireEvent.click(screen.getByTestId('wheel-forward'));
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-fen', 'FEN_AFTER_E5');
  });

  it('sonda tekerlek ileri gitmeye çalışınca sınırın ötesine geçmez', async () => {
    listMyGames.mockResolvedValue(GAMES);
    getGameMoves.mockResolvedValue(MOVES);
    render(<GameAnalysisSection />);
    fireEvent.click(await screen.findByText('Bot · Düzey 4'));
    await screen.findByTestId('analysis-board');

    fireEvent.click(screen.getByTestId('wheel-forward'));
    fireEvent.click(screen.getByTestId('wheel-forward'));
    fireEvent.click(screen.getByTestId('wheel-forward'));
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-fen', 'FEN_AFTER_E5');
  });

  it('tekerlek geri başlangıç konumunun gerisine geçmez', async () => {
    listMyGames.mockResolvedValue(GAMES);
    getGameMoves.mockResolvedValue(MOVES);
    render(<GameAnalysisSection />);
    fireEvent.click(await screen.findByText('Bot · Düzey 4'));
    await screen.findByTestId('analysis-board');

    fireEvent.click(screen.getByTestId('wheel-back'));
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-fen', START_FEN);
  });
});

describe('GameAnalysisSection — Notasyon Verilerini Gizle (madde 2026-09-05 (4))', () => {
  it('onToggleHideNotation, AnalysisBoard\'a hideNotation olarak yansır', async () => {
    listMyGames.mockResolvedValue(GAMES);
    getGameMoves.mockResolvedValue(MOVES);
    render(<GameAnalysisSection />);
    fireEvent.click(await screen.findByText('Bot · Düzey 4'));
    await screen.findByTestId('analysis-board');

    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-hide-notation', 'false');
    fireEvent.click(screen.getByLabelText('Notasyon Verilerini Gizle'));
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-hide-notation', 'true');
  });
});

describe('GameAnalysisSection — "Bu Hamleden Sonrasını Sil" (madde 2026-09-05 (3), geçici/görüntü)', () => {
  it('seçilen hamleden sonrası yerel görünümden kaldırılır', async () => {
    listMyGames.mockResolvedValue(GAMES);
    getGameMoves.mockResolvedValue(MOVES);
    render(<GameAnalysisSection />);
    fireEvent.click(await screen.findByText('Bot · Düzey 4'));
    await screen.findByTestId('analysis-board');

    fireEvent.contextMenu(screen.getByText('e4'));
    fireEvent.click(screen.getByText('Bu Hamleden Sonrasını Sil'));
    expect(screen.queryByText('e5')).not.toBeInTheDocument();
    expect(screen.getByText('e4')).toBeInTheDocument();
  });
});
