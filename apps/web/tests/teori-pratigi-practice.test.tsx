import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/play/TeoriPratigiSolver', () => ({
  TeoriPratigiSolver: ({ question, onSolved, onWrong }: {
    question: { id: string };
    onSolved: () => void;
    onWrong: (msg: string) => void;
  }) => (
    <div data-testid="solver" data-question-id={question.id}>
      <button onClick={onSolved}>fake-solve</button>
      <button onClick={() => onWrong('Bu hamle teorinin dışında.')}>fake-wrong</button>
    </div>
  ),
}));

import { TeoriPratigiPractice } from '@/components/play/TeoriPratigiPractice';
import type { TeoriPratigiQuestion } from '@/lib/customTabsApi';

const Q1: TeoriPratigiQuestion = {
  id: 'q1', code: '001',
  instruction: 'İtalyan Açılışı\'nın ilk hamlelerini oyna',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: ['e4', 'e5', 'Bc4'],
  opening_name: 'İtalyan Açılışı',
  student_color: 'w',
};

const Q2: TeoriPratigiQuestion = {
  ...Q1, id: 'q2', code: '002', opening_name: 'İspanyol Açılışı',
};

describe('TeoriPratigiPractice', () => {
  it('havuz boşsa bilgi mesajı gösterir', () => {
    render(<TeoriPratigiPractice questions={[]} />);
    expect(screen.getByText(/henüz soru yok/)).toBeInTheDocument();
  });

  it('açılış adı, kod ve talimat gösterilir', () => {
    render(<TeoriPratigiPractice questions={[Q1]} />);
    // İki yerde geçer: başlıkta ("♟️ İtalyan Açılışı · 001") ve talimat
    // cümlesinin İÇİNDE ("İtalyan Açılışı'nın ilk hamlelerini oyna").
    expect(screen.getAllByText(/İtalyan Açılışı/)).toHaveLength(2);
    expect(screen.getByText(/001/)).toBeInTheDocument();
    expect(screen.getByText(Q1.instruction)).toBeInTheDocument();
  });

  it('başlangıçta doğru/yanlış kartı ve tekrar/yeni butonları YOKTUR', () => {
    render(<TeoriPratigiPractice questions={[Q1]} />);
    expect(screen.queryByText('Tekrar Pratik Yap')).not.toBeInTheDocument();
    expect(screen.queryByText('Yeni Konuyla Pratik Yap')).not.toBeInTheDocument();
  });

  it('doğru bitince ✓ kartı ve iki buton görünür', () => {
    render(<TeoriPratigiPractice questions={[Q1]} />);
    fireEvent.click(screen.getByText('fake-solve'));
    expect(screen.getByLabelText('Doğru')).toBeInTheDocument();
    expect(screen.getByText('Tekrar Pratik Yap')).toBeInTheDocument();
    expect(screen.getByText('Yeni Konuyla Pratik Yap')).toBeInTheDocument();
  });

  it('teoriden çıkınca ✕ kartı, geri bildirim mesajı ve iki buton görünür', () => {
    render(<TeoriPratigiPractice questions={[Q1]} />);
    fireEvent.click(screen.getByText('fake-wrong'));
    expect(screen.getByLabelText('Yanlış')).toBeInTheDocument();
    expect(screen.getByText('Bu hamle teorinin dışında.')).toBeInTheDocument();
    expect(screen.getByText('Tekrar Pratik Yap')).toBeInTheDocument();
  });

  it('"Tekrar Pratik Yap" AYNI soruyla sıfırlar, kart kaybolur', () => {
    render(<TeoriPratigiPractice questions={[Q1]} />);
    fireEvent.click(screen.getByText('fake-wrong'));
    fireEvent.click(screen.getByText('Tekrar Pratik Yap'));
    expect(screen.queryByLabelText('Yanlış')).not.toBeInTheDocument();
    expect(screen.getByTestId('solver').getAttribute('data-question-id')).toBe('q1');
  });

  it('"Yeni Konuyla Pratik Yap" BAŞKA bir soru seçer', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<TeoriPratigiPractice questions={[Q1, Q2]} />);
    const initialId = screen.getByTestId('solver').getAttribute('data-question-id');
    fireEvent.click(screen.getByText('fake-solve'));
    fireEvent.click(screen.getByText('Yeni Konuyla Pratik Yap'));
    expect(screen.getByTestId('solver').getAttribute('data-question-id')).not.toBe(initialId);
    expect(screen.queryByLabelText('Doğru')).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
