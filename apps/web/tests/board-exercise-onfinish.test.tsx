import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const q = (instruction: string, target: string): BoardExerciseConfig => ({
  type: 'click_square',
  instruction,
  fen: '8/8/8/8/8/8/4P3/8 w - - 0 1',
  target_squares: [target],
});

const click = (c: HTMLElement, sq: string) =>
  fireEvent.click(c.querySelector(`[data-square="${sq}"]`)!);

describe('BoardExercise onFinish', () => {
  it('hepsi doğruysa correct=total ile çağrılır', () => {
    const onFinish = vi.fn();
    const { container } = render(
      <BoardExercise exercises={[q('S1', 'e2'), q('S2', 'e2')]} done={false}
        onCorrect={vi.fn()} onFinish={onFinish} />,
    );
    click(container, 'e2');
    fireEvent.click(screen.getByText('Sonraki Soruya Geç'));
    click(container, 'e2');
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith({ correct: 2, total: 2 });
  });

  it('YANLIŞ cevaplar doğru sayılmaz (puanlamanın temeli)', () => {
    const onFinish = vi.fn();
    const { container } = render(
      <BoardExercise exercises={[q('S1', 'e2'), q('S2', 'e2')]} done={false}
        onCorrect={vi.fn()} onFinish={onFinish} />,
    );
    click(container, 'a1'); // 1. soru YANLIŞ
    fireEvent.click(screen.getByText('Sonraki Soruya Geç'));
    click(container, 'e2'); // 2. soru doğru
    expect(onFinish).toHaveBeenCalledWith({ correct: 1, total: 2 });
  });

  it('son soru yanlışsa da çağrılır (oturum yine biter)', () => {
    const onFinish = vi.fn();
    const { container } = render(
      <BoardExercise exercises={[q('S1', 'e2')]} done={false}
        onCorrect={vi.fn()} onFinish={onFinish} />,
    );
    click(container, 'a1');
    expect(onFinish).toHaveBeenCalledWith({ correct: 0, total: 1 });
  });

  it('oturum bitmeden çağrılmaz', () => {
    const onFinish = vi.fn();
    const { container } = render(
      <BoardExercise exercises={[q('S1', 'e2'), q('S2', 'e2')]} done={false}
        onCorrect={vi.fn()} onFinish={onFinish} />,
    );
    click(container, 'e2'); // sadece 1. soru
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('REGRESYON: onFinish verilmese de çökmez (opsiyonel prop)', () => {
    const { container } = render(
      <BoardExercise exercises={[q('S1', 'e2')]} done={false} onCorrect={vi.fn()} />,
    );
    expect(() => click(container, 'e2')).not.toThrow();
  });
});
