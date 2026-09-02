import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TeoriPratigiSolver } from '@/components/play/TeoriPratigiSolver';
import type { TeoriPratigiQuestion } from '@/lib/customTabsApi';

const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1';
/** Siyaha fazladan bir kale eklenir — "sporcu siyah" testlerinde teorinin
 *  DIŞINDA ama LEGAL bir hamle denemek için (yalnız şahla g8'den TEK legal
 *  kaçış Kf8 olduğundan "yanlış ama legal" bir kare bulunamıyordu). */
const TWO_SIDED_EXTRA_ROOK = 'r5k1/8/5K2/8/5R2/8/8/8 w - - 0 1';

const WHITE_STUDENT: TeoriPratigiQuestion = {
  id: 'q1',
  instruction: 'Kaleyi h4e oyna',
  fen: TWO_SIDED,
  moves: ['Rh4', 'Kf8'],
  opening_name: 'Test Açılışı',
  student_color: 'w',
};

const BLACK_STUDENT: TeoriPratigiQuestion = {
  ...WHITE_STUDENT,
  fen: TWO_SIDED_EXTRA_ROOK,
  student_color: 'b',
};

function clickSquare(container: HTMLElement, square: string) {
  fireEvent.click(container.querySelector(`[data-square="${square}"]`)!);
}

describe('TeoriPratigiSolver — sporcu BEYAZ (madde: notasyonun kendi sırasıyla AYNI)', () => {
  it('tahtayı 64 kareyle render eder', () => {
    const { container } = render(
      <TeoriPratigiSolver question={WHITE_STUDENT} disabled={false} onSolved={vi.fn()} onWrong={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
  });

  it('YANLIŞ hamlede onWrong çağrılır, onSolved çağrılmaz', () => {
    const onWrong = vi.fn();
    const onSolved = vi.fn();
    const { container } = render(
      <TeoriPratigiSolver question={WHITE_STUDENT} disabled={false} onSolved={onSolved} onWrong={onWrong} />,
    );
    clickSquare(container, 'f4'); // kaleyi seç
    clickSquare(container, 'f5'); // legal ama teorinin dışında
    expect(onWrong).toHaveBeenCalledTimes(1);
    expect(onSolved).not.toHaveBeenCalled();
  });

  it('disabled iken tıklama hiçbir callback tetiklemez', () => {
    const onWrong = vi.fn();
    const onSolved = vi.fn();
    const { container } = render(
      <TeoriPratigiSolver question={WHITE_STUDENT} disabled onSolved={onSolved} onWrong={onWrong} />,
    );
    clickSquare(container, 'f4');
    clickSquare(container, 'h4');
    expect(onWrong).not.toHaveBeenCalled();
    expect(onSolved).not.toHaveBeenCalled();
  });
});

describe('TeoriPratigiSolver — sporcu SİYAH (madde 2026-09-02 devam: studentParity=1)', () => {
  it('mount olur olmaz rakibin (beyazın) İLK hamlesi otomatik oynanır', () => {
    const { container } = render(
      <TeoriPratigiSolver question={BLACK_STUDENT} disabled={false} onSolved={vi.fn()} onWrong={vi.fn()} />,
    );
    // Rh4 zaten oynanmış olmalı — f4 artık boş, h4'te kale var.
    expect(container.querySelector('[data-square="h4"] [data-piece]')).toBeTruthy();
    expect(container.querySelector('[data-square="f4"] [data-piece]')).toBeFalsy();
  });

  it('sporcu (siyah) teorinin dışına çıkarsa onWrong çağrılır', () => {
    const onWrong = vi.fn();
    const onSolved = vi.fn();
    const { container } = render(
      <TeoriPratigiSolver question={BLACK_STUDENT} disabled={false} onSolved={onSolved} onWrong={onWrong} />,
    );
    clickSquare(container, 'a8'); // kaleyi seç (şahın TEK legal kaçışı Kf8 olduğu için kale ile test edilir)
    clickSquare(container, 'a7'); // legal ama teorinin dışında (Kf8 bekleniyordu)
    expect(onWrong).toHaveBeenCalledTimes(1);
    expect(onSolved).not.toHaveBeenCalled();
  });
});
