import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Madde 2026-09-14 (3c): "Hatalarını Gözden Geçir" — /analiz/hatalarim
 * sayfası. Backend'den (fetchGameAnalysis) o maçın mistakeMoves listesini
 * çeker, her birini MovePieceSolver ile ("doğru hamleyi bul") interaktif
 * bir egzersize çevirir. MovePieceSolver'ın kendisi (react-chessboard)
 * move-piece-solver.test.tsx'te ayrıca test ediliyor — burada mock'lanır,
 * SADECE bu sayfanın exercise seçimi/ilerleme mantığı test edilir.
 */
let searchValue = 'gameId=42';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchValue),
}));
vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: () => {} }));

const mocks = vi.hoisted(() => ({ fetchGameAnalysis: vi.fn() }));
vi.mock('@/lib/chess/gameAnalysisApi', () => mocks);

vi.mock('@/components/lesson-steps/MovePieceSolver', () => ({
  MovePieceSolver: ({ exercise, onSolved, onWrong }: {
    exercise: { fen: string; moves: string[] };
    onSolved: () => void;
    onWrong: (msg: string) => void;
  }) => (
    <div data-testid="move-piece-solver">
      <p data-testid="exercise-fen">{exercise.fen}</p>
      <p data-testid="exercise-best-san">{exercise.moves[0]}</p>
      <button type="button" onClick={onSolved}>test-solve</button>
      <button type="button" onClick={() => onWrong('yanlış')}>test-wrong</button>
    </div>
  ),
}));

import HatalarimPage from '@/app/(child)/analiz/hatalarim/page';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

beforeEach(() => {
  vi.clearAllMocks();
  searchValue = 'gameId=42';
});

it('?gameId= parametresi yoksa/geçersizse "Geçersiz bağlantı." gösterir', async () => {
  searchValue = '';
  render(<HatalarimPage />);
  await waitFor(() => screen.getByText('Geçersiz bağlantı.'));
  expect(mocks.fetchGameAnalysis).not.toHaveBeenCalled();
});

it('analiz hiç bulunamazsa (birkaç deneme sonrası) uyarı gösterir', async () => {
  mocks.fetchGameAnalysis.mockResolvedValue(null);
  render(<HatalarimPage />);
  await waitFor(
    () => screen.getByText(/Bu maçın analizi henüz hazır değil/),
    { timeout: 6000 },
  );
  expect(mocks.fetchGameAnalysis).toHaveBeenCalledWith(42);
}, 10000);

it('mistakeMoves boşsa tebrik mesajı gösterir', async () => {
  mocks.fetchGameAnalysis.mockResolvedValue({
    inaccuracies: 0, mistakes: 0, blunders: 0, acpl: 10, accuracy: 98,
    phaseAccuracy: { opening: 98, middlegame: 98, endgame: null },
    mistakeMoves: [],
  });
  render(<HatalarimPage />);
  await waitFor(() => screen.getByText('Bu maçta hiç hata yapmadın!'));
});

it('mistakeMoves varsa doğru fen/best-move ile egzersiz kurulur, "Kaydet" sonrası sıradakine geçer', async () => {
  mocks.fetchGameAnalysis.mockResolvedValue({
    inaccuracies: 0, mistakes: 1, blunders: 1, acpl: 80, accuracy: 60,
    phaseAccuracy: { opening: 60, middlegame: null, endgame: null },
    mistakeMoves: [
      { ply: 1, fenBefore: START_FEN, playedSan: 'a3', bestMove: 'e2e4', cpLoss: 120, severity: 'mistake' },
      { ply: 3, fenBefore: FEN_AFTER_E4, playedSan: 'a6', bestMove: 'g8f6', cpLoss: 350, severity: 'blunder' },
    ],
  });
  render(<HatalarimPage />);

  await waitFor(() => screen.getByText(/Hata — doğru hamleyi bul!/));
  expect(screen.getByText('1/2')).toBeInTheDocument();
  expect(screen.getByTestId('exercise-fen')).toHaveTextContent(START_FEN);
  expect(screen.getByTestId('exercise-best-san')).toHaveTextContent('e4');

  fireEvent.click(screen.getByText('test-solve'));

  await waitFor(() => screen.getByText(/Vahim hata — doğru hamleyi bul!/));
  expect(screen.getByText('2/2')).toBeInTheDocument();
  expect(screen.getByTestId('exercise-best-san')).toHaveTextContent('Nf6');

  fireEvent.click(screen.getByText('test-solve'));
  await waitFor(() => screen.getByText('Tüm hatalarını gözden geçirdin!'));
});

it('onWrong çağrılınca hata mesajı gösterilir, egzersiz değişmez', async () => {
  mocks.fetchGameAnalysis.mockResolvedValue({
    inaccuracies: 0, mistakes: 1, blunders: 0, acpl: 80, accuracy: 60,
    phaseAccuracy: { opening: 60, middlegame: null, endgame: null },
    mistakeMoves: [
      { ply: 1, fenBefore: START_FEN, playedSan: 'a3', bestMove: 'e2e4', cpLoss: 120, severity: 'mistake' },
    ],
  });
  render(<HatalarimPage />);
  await waitFor(() => screen.getByText('1/1'));

  fireEvent.click(screen.getByText('test-wrong'));
  await waitFor(() => screen.getByText('yanlış'));
  expect(screen.getByText('1/1')).toBeInTheDocument();
});

it('FEN + UCI\'den geçersiz bir hamle üretilirse (bozuk veri) o egzersiz atlanır, çökmez', async () => {
  mocks.fetchGameAnalysis.mockResolvedValue({
    inaccuracies: 0, mistakes: 1, blunders: 0, acpl: 80, accuracy: 60,
    phaseAccuracy: { opening: 60, middlegame: null, endgame: null },
    mistakeMoves: [
      { ply: 1, fenBefore: FEN_AFTER_E4, playedSan: 'a3', bestMove: 'zz99', cpLoss: 120, severity: 'mistake' },
    ],
  });
  render(<HatalarimPage />);
  await waitFor(() => screen.getByText('Tüm hatalarını gözden geçirdin!'));
});
