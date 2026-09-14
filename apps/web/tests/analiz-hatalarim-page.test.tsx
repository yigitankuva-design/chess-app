import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Madde 2026-09-14 (3c) / 2026-09-15 (sunucu analiz motoru): "Hatalarını
 * Gözden Geçir" — /analiz/hatalarim sayfası. Analiz artık backend'de
 * (native Stockfish) hesaplanıyor; bu sayfa `useServerGameAnalysis`'i
 * kullanır — o hook'un KENDİ mantığı (istek+poll) use-server-game-analysis
 * testinde ayrıca sınanıyor, burada MOCK'lanır. `MovePieceSolver`'ın
 * kendisi (react-chessboard) move-piece-solver.test.tsx'te test ediliyor —
 * burada da mock'lanır, SADECE bu sayfanın exercise seçimi/ilerleme
 * mantığı test edilir.
 */
let searchValue = 'gameId=42';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchValue),
}));
vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: () => {} }));

const mocks = vi.hoisted(() => ({ useServerGameAnalysis: vi.fn() }));
vi.mock('@/lib/chess/useServerGameAnalysis', () => mocks);

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

function mockAnalysis(status: 'pending' | 'done' | 'error', mistakeMoves: unknown[] = []) {
  mocks.useServerGameAnalysis.mockReturnValue({
    status,
    evalByPly: {},
    summary: status === 'done' ? {
      inaccuracies: 0, mistakes: 0, blunders: 0, acpl: 10, accuracy: 98,
      phaseAccuracy: { opening: 98, middlegame: 98, endgame: null },
      mistakeMoves,
    } : null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  searchValue = 'gameId=42';
  mockAnalysis('pending');
});

it('?gameId= parametresi yoksa/geçersizse "Geçersiz bağlantı." gösterir', async () => {
  searchValue = '';
  render(<HatalarimPage />);
  await waitFor(() => screen.getByText('Geçersiz bağlantı.'));
});

it('analiz durumu "error" ise uyarı gösterir', async () => {
  mockAnalysis('error');
  render(<HatalarimPage />);
  await waitFor(() => screen.getByText(/Bu maçın analizi henüz hazır değil/));
});

it('analiz devam ederken "Yükleniyor…" gösterir', async () => {
  mockAnalysis('pending');
  render(<HatalarimPage />);
  await waitFor(() => screen.getByText('Yükleniyor…'));
});

it('mistakeMoves boşsa tebrik mesajı gösterir', async () => {
  mockAnalysis('done', []);
  render(<HatalarimPage />);
  await waitFor(() => screen.getByText('Bu maçta hiç hata yapmadın!'));
});

it('mistakeMoves varsa doğru fen/best-move ile egzersiz kurulur, "Kaydet" sonrası sıradakine geçer', async () => {
  mockAnalysis('done', [
    { ply: 1, fenBefore: START_FEN, playedSan: 'a3', bestMove: 'e2e4', cpLoss: 120, severity: 'mistake' },
    { ply: 3, fenBefore: FEN_AFTER_E4, playedSan: 'a6', bestMove: 'g8f6', cpLoss: 350, severity: 'blunder' },
  ]);
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
  mockAnalysis('done', [
    { ply: 1, fenBefore: START_FEN, playedSan: 'a3', bestMove: 'e2e4', cpLoss: 120, severity: 'mistake' },
  ]);
  render(<HatalarimPage />);
  await waitFor(() => screen.getByText('1/1'));

  fireEvent.click(screen.getByText('test-wrong'));
  await waitFor(() => screen.getByText('yanlış'));
  expect(screen.getByText('1/1')).toBeInTheDocument();
});

it('FEN + UCI\'den geçersiz bir hamle üretilirse (bozuk veri) o egzersiz atlanır, çökmez', async () => {
  mockAnalysis('done', [
    { ply: 1, fenBefore: FEN_AFTER_E4, playedSan: 'a3', bestMove: 'zz99', cpLoss: 120, severity: 'mistake' },
  ]);
  render(<HatalarimPage />);
  await waitFor(() => screen.getByText('Tüm hatalarını gözden geçirdin!'));
});
