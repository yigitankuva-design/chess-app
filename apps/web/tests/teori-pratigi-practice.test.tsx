import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/play/TeoriPratigiSolver', () => ({
  TeoriPratigiSolver: ({ question, onSolved, onWrong, onMovesChange }: {
    question: { id: string };
    onSolved: () => void;
    onWrong: (msg: string) => void;
    onMovesChange?: (moves: string[]) => void;
  }) => (
    <div data-testid="solver" data-question-id={question.id}>
      <button onClick={onSolved}>fake-solve</button>
      <button onClick={() => onWrong('Bu hamle teorinin dışında.')}>fake-wrong</button>
      <button onClick={() => onMovesChange?.(['e4', 'e5'])}>fake-move</button>
    </div>
  ),
}));

import { TeoriPratigiPractice } from '@/components/play/TeoriPratigiPractice';
import { TEORI_PRATIGI_INSTRUCTION } from '@/lib/admin/teoriPratigiSteps';
import type { TeoriPratigiQuestion } from '@/lib/customTabsApi';

const Q1: TeoriPratigiQuestion = {
  id: 'q1', code: '001',
  // Madde 2026-09-06 (üçüncü tur/3): bu alan artık render'da YOK SAYILIR —
  // sporcuya HER ZAMAN TEORI_PRATIGI_INSTRUCTION gösterilir.
  instruction: 'eski-farklı-bir-talimat',
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

  it('açılış adı, kod ve SABİT talimat gösterilir (q.instruction YOK SAYILIR)', () => {
    render(<TeoriPratigiPractice questions={[Q1]} />);
    expect(screen.getByText(/İtalyan Açılışı/)).toBeInTheDocument();
    expect(screen.getByText(/001/)).toBeInTheDocument();
    expect(screen.getByText(TEORI_PRATIGI_INSTRUCTION)).toBeInTheDocument();
    expect(screen.queryByText('eski-farklı-bir-talimat')).not.toBeInTheDocument();
  });

  it('madde 2026-09-04 (6): başlıkta/talimat kutusunda ikon YOKTUR, HAMLELER bölümü VAR ve güncellenir', () => {
    render(<TeoriPratigiPractice questions={[Q1]} />);
    expect(screen.queryByText('♟️')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Hamleler')).toBeInTheDocument();
    expect(screen.getByText('Henüz hamle yapılmadı.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('fake-move'));
    expect(screen.queryByText('Henüz hamle yapılmadı.')).not.toBeInTheDocument();
    // "e4" onSelectPly verilmediği için düz metin (buton değil) — bitişik
    // parça (bkz. MoveList.tsx move()), tek başına bir öğe değil. Madde
    // 2026-09-06 (4): ayırıcı artık dar boşluksuz tire.
    expect(screen.getByLabelText('Hamleler')).toHaveTextContent('e4-e5');
  });

  it('başlangıçta doğru/yanlış kartı ve tekrar/yeni butonları YOKTUR', () => {
    render(<TeoriPratigiPractice questions={[Q1]} />);
    expect(screen.queryByText('Teoriyi Tekrar Et')).not.toBeInTheDocument();
    expect(screen.queryByText('Farklı Teoriye Geç')).not.toBeInTheDocument();
  });

  it('doğru bitince ✓ kartı ve iki buton görünür', () => {
    render(<TeoriPratigiPractice questions={[Q1]} />);
    fireEvent.click(screen.getByText('fake-solve'));
    expect(screen.getByLabelText('Doğru')).toBeInTheDocument();
    expect(screen.getByText('Teoriyi Tekrar Et')).toBeInTheDocument();
    expect(screen.getByText('Farklı Teoriye Geç')).toBeInTheDocument();
  });

  it('madde 2026-09-06 (ikinci tur/G): butonlar ve durum kartı TEK satırda 3 sütun', () => {
    render(<TeoriPratigiPractice questions={[Q1]} />);
    fireEvent.click(screen.getByText('fake-solve'));
    const row = screen.getByText('Teoriyi Tekrar Et').parentElement;
    expect(row?.className).toContain('grid-cols-3');
    expect(row).toHaveTextContent('Farklı Teoriye Geç');
    expect(row?.querySelector('[aria-label="Doğru"]')).toBeInTheDocument();
  });

  it('teoriden çıkınca ✕ kartı, geri bildirim mesajı ve iki buton görünür', () => {
    render(<TeoriPratigiPractice questions={[Q1]} />);
    fireEvent.click(screen.getByText('fake-wrong'));
    expect(screen.getByLabelText('Yanlış')).toBeInTheDocument();
    expect(screen.getByText('Bu hamle teorinin dışında.')).toBeInTheDocument();
    expect(screen.getByText('Teoriyi Tekrar Et')).toBeInTheDocument();
  });

  it('"Teoriyi Tekrar Et" AYNI soruyla sıfırlar, kart kaybolur', () => {
    render(<TeoriPratigiPractice questions={[Q1]} />);
    fireEvent.click(screen.getByText('fake-wrong'));
    fireEvent.click(screen.getByText('Teoriyi Tekrar Et'));
    expect(screen.queryByLabelText('Yanlış')).not.toBeInTheDocument();
    expect(screen.getByTestId('solver').getAttribute('data-question-id')).toBe('q1');
  });

  it('"Farklı Teoriye Geç" BAŞKA bir soru seçer', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<TeoriPratigiPractice questions={[Q1, Q2]} />);
    const initialId = screen.getByTestId('solver').getAttribute('data-question-id');
    fireEvent.click(screen.getByText('fake-solve'));
    fireEvent.click(screen.getByText('Farklı Teoriye Geç'));
    expect(screen.getByTestId('solver').getAttribute('data-question-id')).not.toBe(initialId);
    expect(screen.queryByLabelText('Doğru')).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
