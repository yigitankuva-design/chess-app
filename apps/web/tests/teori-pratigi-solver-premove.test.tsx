import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

/** Tahta stub'i: üst bileşenin verdiği ön-hamle geri çağrısını dışarı açar,
 *  böylece test rakip (bot) cevabı beklenirken hamle seçebilir — BotGame'in
 *  premove testindeki AYNI desen (jsdom'un react-chessboard'ı gerçek bir
 *  hamle sonrası yeniden render ederken çöktüğü, bilinen bir kısıt —
 *  bkz. move-piece-solver.test.tsx'in de asla tam tamamlanmayı denememesi). */
let firePremove: ((from: string, to: string) => void) | null = null;
let lastInteractive: boolean | undefined;
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, interactive, onPremove, onPieceDrop }: {
    fen: string;
    interactive?: boolean;
    onPremove?: (f: string, t: string) => void;
    onPieceDrop?: (f: string, t: string) => boolean;
  }) => {
    firePremove = onPremove ?? null;
    lastInteractive = interactive;
    return (
      <div data-testid="board" data-fen={fen} data-interactive={String(!!interactive)}>
        <button type="button" onClick={() => onPieceDrop?.('e2', 'e4')}>oyna-e4</button>
      </div>
    );
  },
}));

import { TeoriPratigiSolver } from '@/components/play/TeoriPratigiSolver';
import type { TeoriPratigiQuestion } from '@/lib/customTabsApi';

const QUESTION: TeoriPratigiQuestion = {
  id: 'q1',
  instruction: 'İlk hamleleri oyna',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: ['e4', 'e5', 'Nf3', 'Nc6'],
  opening_name: 'İtalyan Açılışı',
  student_color: 'w',
};

const board = () => screen.getByTestId('board');

beforeEach(() => {
  firePremove = null;
  lastInteractive = undefined;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TeoriPratigiSolver — ön-hamle (madde: Pratik Yap sekmesinde de olsun)', () => {
  it('rakip (bot) cevabı beklenirken tahta interaktif DEĞİLDİR (ön-hamle diline girer)', () => {
    render(<TeoriPratigiSolver question={QUESTION} disabled={false} onSolved={vi.fn()} onWrong={vi.fn()} />);
    expect(lastInteractive).toBe(true); // sıra sporcuda, henüz kimse oynamadı
    fireEvent.click(screen.getByText('oyna-e4')); // sporcu e4 oynar, rakip düşünmeye başlar
    expect(board().getAttribute('data-interactive')).toBe('false');
  });

  it('bot düşünürken verilen GEÇERLİ ön-hamle, sıra gelince kendiliğinden oynanır', () => {
    render(<TeoriPratigiSolver question={QUESTION} disabled={false} onSolved={vi.fn()} onWrong={vi.fn()} />);
    fireEvent.click(screen.getByText('oyna-e4')); // e4 — doğru, rakip (e5) 450ms sonra oynayacak
    firePremove!('g1', 'f3'); // rakip düşünürken sporcu Nf3'ü önceden seçer
    act(() => { vi.advanceTimersByTime(500); }); // rakip e5 oynar, sıra sporcuya geçer, ön-hamle çözülür
    const fen = board().getAttribute('data-fen') ?? '';
    expect(fen).toContain('5N2'); // at f3'te — ön-hamle OTOMATİK oynandı
  });

  it('GEÇERSİZ ön-hamle sessizce iptal edilir, oyun normal devam eder', () => {
    render(<TeoriPratigiSolver question={QUESTION} disabled={false} onSolved={vi.fn()} onWrong={vi.fn()} />);
    fireEvent.click(screen.getByText('oyna-e4'));
    firePremove!('a1', 'a8'); // kural dışı (kale kendi piyonunun üzerinden geçemez)
    act(() => { vi.advanceTimersByTime(500); });
    const fen = board().getAttribute('data-fen') ?? '';
    expect(fen).toContain(' w '); // sıra sporcuda, oyun kilitlenmedi
    expect(fen).not.toContain('R7'); // kale a8'e GİTMEDİ
    expect(board().getAttribute('data-interactive')).toBe('true'); // tekrar tıklanabilir
  });
});
