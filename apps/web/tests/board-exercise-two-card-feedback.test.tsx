import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const clickSq = (instruction: string, target: string): BoardExerciseConfig => ({
  type: 'click_square',
  instruction,
  fen: '8/8/8/8/8/8/4P3/8 w - - 0 1',
  target_squares: [target],
});

/** e2-e4 tek hamlelik "Taşı Oynat" sorusu (eski format). */
const movePiece = (): BoardExerciseConfig => ({
  type: 'move_piece',
  instruction: 'Piyonu ilerlet',
  fen: '8/8/8/8/8/8/4P3/8 w - - 0 1',
  piece_square: 'e2',
  target_squares: ['e4'],
});

const click = (c: HTMLElement, sq: string) =>
  fireEvent.click(c.querySelector(`[data-square="${sq}"]`)!);

describe('BoardExercise — madde 6: yan yana iki kart', () => {
  it('doğru cevapta sağda yeşil tik, solda "Sonraki Soruya Geç" kartı çıkar', () => {
    const { container } = render(
      <BoardExercise exercises={[clickSq('S1', 'e2'), clickSq('S2', 'e2')]}
        done={false} onCorrect={vi.fn()} />,
    );
    click(container, 'e2');
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText('Sonraki Soruya Geç')).toBeInTheDocument();
  });

  it('yanlış cevapta (kilitli) sağda kırmızı çarpı, solda yine "Sonraki Soruya Geç" çıkar', () => {
    const { container } = render(
      <BoardExercise exercises={[clickSq('S1', 'e2'), clickSq('S2', 'e2')]}
        done={false} onCorrect={vi.fn()} />,
    );
    click(container, 'a1'); // yanlış kare — click_square'de tekrar deneme yok
    expect(screen.getByText('✕')).toBeInTheDocument();
    expect(screen.getByText('Sonraki Soruya Geç')).toBeInTheDocument();
  });

  it('son (tek) soruda "next" kartı çıkmaz, sadece geri bildirim kartı görünür', () => {
    const { container } = render(
      <BoardExercise exercises={[clickSq('S1', 'e2')]}
        done={false} onCorrect={vi.fn()} onFinish={vi.fn()} />,
    );
    click(container, 'e2');
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.queryByText('Sonraki Soruya Geç')).not.toBeInTheDocument();
  });

  it('click_square (hareketle ilgisiz) sorularda notasyon kartı GÖRÜNMEZ', () => {
    const { container } = render(
      <BoardExercise exercises={[clickSq('S1', 'e2'), clickSq('S2', 'e2')]}
        done={false} onCorrect={vi.fn()} />,
    );
    click(container, 'e2');
    expect(screen.queryByLabelText('Hamleler')).not.toBeInTheDocument();
  });

  it('taş hareketi sorusunda (move_piece) doğru cevapta notasyon kartı sporcunun hamlesini gösterir', () => {
    const { container } = render(
      <BoardExercise exercises={[movePiece(), clickSq('S2', 'e2')]}
        done={false} onCorrect={vi.fn()} />,
    );
    click(container, 'e2'); // taşı seç
    click(container, 'e4'); // hedefe oyna — doğru
    const notasyon = screen.getByLabelText('Hamleler');
    expect(notasyon.textContent).toContain('e4');
  });
});
