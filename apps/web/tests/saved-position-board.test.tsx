import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

/** Konum kaydedilmiş bir "Kareye Tıkla" sorusu — savedFen initial.fen'den dolar
 *  (ExerciseForm.tsx:179-181). */
const initial = {
  type: 'click_square' as const,
  instruction: 'Beyaz şaha tıkla',
  fen: '8/8/8/8/4K3/8/8/8 w - - 0 1',
  target_squares: ['e4'],
};

describe('Doğru kare seçerken konum önizlemesi', () => {
  it('kaydedilmiş konumu gösteren bir tahta vardır', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} initial={initial} />);
    expect(container.querySelector('[data-testid="saved-position-board"]')).toBeInTheDocument();
  });

  it('seçili cevap karesi tahtada işaretlenir', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} initial={initial} />);
    const board = container.querySelector('[data-testid="saved-position-board"]') as HTMLElement;
    const overlay = board.querySelector('[data-square="e4"] > div') as HTMLElement;
    expect(overlay.style.borderRadius).toBe('50%');
  });

  it('önizleme tahtasına tıklamak seçimi DEĞİŞTİRMEZ', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} initial={initial} />);
    const board = container.querySelector('[data-testid="saved-position-board"]') as HTMLElement;
    fireEvent.click(board.querySelector('[data-square="a1"]')!);
    // Kare listesindeki "Seçili:" satırı değişmemeli — seçim yalnızca listeden yapılır.
    expect(screen.getByText(/Seçili: e4/)).toBeInTheDocument();
  });
});
