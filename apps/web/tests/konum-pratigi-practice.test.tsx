import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KonumPratigiPractice } from '@/components/play/KonumPratigiPractice';
import type { KonumPratigiQuestion } from '@/lib/customTabsApi';

const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1';

const Q1: KonumPratigiQuestion = {
  id: 'q1', code: '001',
  instruction: 'Bu hangi açılıştır?',
  fen: FEN,
  answer_kind: 'sentence',
  options: ['İtalyan Açılışı', 'İspanyol Açılışı'],
  correct_index: 0,
};

describe('KonumPratigiPractice', () => {
  it('havuz boşsa bilgi mesajı gösterir', () => {
    render(<KonumPratigiPractice questions={[]} />);
    expect(screen.getByText(/henüz soru yok/)).toBeInTheDocument();
  });

  it('soru talimatı, kodu ve şıkları gösterir', () => {
    render(<KonumPratigiPractice questions={[Q1]} />);
    expect(screen.getByText('Bu hangi açılıştır?')).toBeInTheDocument();
    expect(screen.getByText(/001/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'İtalyan Açılışı' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'İspanyol Açılışı' })).toBeInTheDocument();
  });

  it('doğru şık seçilince ✓ geri bildirimi görünür', () => {
    render(<KonumPratigiPractice questions={[Q1]} />);
    fireEvent.click(screen.getByRole('button', { name: 'İtalyan Açılışı' }));
    expect(screen.getByLabelText('Doğru')).toBeInTheDocument();
  });

  it('yanlış şık seçilince ✕ geri bildirimi görünür (havuzda başka soru varsa)', () => {
    // Tek sorulu havuzda son soru yanlış cevaplanınca BoardExercise doğrudan
    // "Bu bölümdeki tüm sorular cevaplandı." özetine geçiyor (kendi mevcut
    // davranışı) — ✕ kartını görmek için ikinci bir soru gerekiyor.
    const Q2: KonumPratigiQuestion = { ...Q1, id: 'q2', code: '002' };
    render(<KonumPratigiPractice questions={[Q1, Q2]} />);
    fireEvent.click(screen.getByRole('button', { name: 'İspanyol Açılışı' }));
    expect(screen.getByLabelText('Yanlış')).toBeInTheDocument();
  });

  it('madde 2026-09-04 (5): talimat kutusunda 🎯 ikonu YOKTUR, "0/1"/"Soru X/Y" kenarlıklı kutuda', () => {
    render(<KonumPratigiPractice questions={[Q1]} />);
    const instruction = screen.getByText('Bu hangi açılıştır?');
    expect(instruction.parentElement).not.toHaveTextContent('🎯');
    // "0/1" → ProgressDots'un kendi iç div'i → boxedProgress'in eklediği kenarlıklı sarmalayıcı.
    expect(screen.getByText('0/1').parentElement?.parentElement).toHaveStyle({ border: '1px solid var(--t-border)' });
    expect(screen.getByText('Soru 1/1')).toHaveStyle({ border: '1px solid var(--t-border)' });
  });

  it('madde 2026-09-06 (ikinci tur/F): başlık progress satırında, tahta büyütülmüş', () => {
    render(<KonumPratigiPractice questions={[Q1]} />);
    expect(screen.getByText('Konum Pratiği')).toBeInTheDocument();
    // Aynı satırda: "0/1" göstergesi ve "Soru 1/1" rozetiyle birlikte.
    const row = screen.getByText('Konum Pratiği').parentElement;
    expect(row).toHaveTextContent('0/1');
    expect(row).toHaveTextContent('Soru 1/1');
    // Q1 bir sentence_question (sentence_show_board) — tahta ChoiceQuestionVisual'ın
    // "sentence-board" kartı, isBoardExercise'in coord-frame'i DEĞİL.
    expect(screen.getByTestId('sentence-board')).toHaveStyle({ maxWidth: '360px' });
  });

  it('havuz KARIŞTIRILIR — sıra admin sırasıyla birebir aynı olmak zorunda değildir', () => {
    // Math.random hep 0 dönerse Fisher–Yates sırayı TERSİNE çevirir — deterministik kanıt.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const Q2: KonumPratigiQuestion = { ...Q1, id: 'q2', code: '002', instruction: 'İkinci soru' };
    render(<KonumPratigiPractice questions={[Q1, Q2]} />);
    expect(screen.getByText('İkinci soru')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
