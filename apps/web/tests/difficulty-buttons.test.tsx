import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';
import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';

describe('ExerciseForm — zorluk butonları', () => {
  it('Kolay/Orta/Zor butonları gösterilir, eski değer (2) Kolay olarak vurgulanır ama tıklanmadan değişmez', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExerciseForm onSubmit={onSubmit} initial={{
      type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      target_squares: ['e4'], difficulty: 2,
    }} />);
    expect(screen.getByText('Kolay')).toBeInTheDocument();
    expect(screen.getByText('Orta')).toBeInTheDocument();
    expect(screen.getByText('Zor')).toBeInTheDocument();
    expect(screen.getByText('Kolay').className).toMatch(/border-cyan-400/);
    fireEvent.click(screen.getByText('Soruyu kaydet'));
    expect(onSubmit.mock.calls[0][0].difficulty).toBe(2); // tıklanmadı, eski değer korunur
  });

  it('Zor butonuna tıklanınca difficulty 5 olarak gönderilir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExerciseForm onSubmit={onSubmit} initial={{
      type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      target_squares: ['e4'], difficulty: 2,
    }} />);
    fireEvent.click(screen.getByText('Zor'));
    fireEvent.click(screen.getByText('Soruyu kaydet'));
    expect(onSubmit.mock.calls[0][0].difficulty).toBe(5);
  });
});

describe('ChoiceExerciseFields — zorluk butonları', () => {
  it('Kolay/Orta/Zor butonları gösterilir', () => {
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={vi.fn()} />);
    expect(screen.getByText('Kolay')).toBeInTheDocument();
    expect(screen.getByText('Orta')).toBeInTheDocument();
    expect(screen.getByText('Zor')).toBeInTheDocument();
  });
});
