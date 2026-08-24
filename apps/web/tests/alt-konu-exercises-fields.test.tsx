import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/components/admin/ExerciseForm', async () => {
  const actual = await vi.importActual<typeof import('@/components/admin/ExerciseForm')>(
    '@/components/admin/ExerciseForm',
  );
  return {
    ...actual,
    ExerciseForm: ({ onSubmit, onCancel, initial, onlyBoardFamily, allowedBoardTypes }: {
      onSubmit: (ex: unknown) => Promise<void>;
      onCancel?: () => void;
      initial?: { instruction: string };
      onlyBoardFamily?: boolean;
      allowedBoardTypes?: string[];
    }) => (
      <div data-testid={initial ? 'exercise-form-edit' : 'exercise-form-add'}>
        <p>onlyBoardFamily: {String(!!onlyBoardFamily)}</p>
        <p>allowedBoardTypes: {(allowedBoardTypes || []).join(',')}</p>
        <button onClick={() => onSubmit({ type: 'click_square', instruction: 'test soru', fen: 'x', target_squares: ['e4'] })}>
          test-submit
        </button>
        {onCancel && <button onClick={onCancel}>test-cancel</button>}
      </div>
    ),
  };
});

import { AltKonuExercisesFields } from '@/components/admin/AltKonuExercisesFields';
import type { BoardExercise } from '@/components/admin/ExerciseForm';

describe('AltKonuExercisesFields', () => {
  it('havuz boşken sadece ekleme formu görünür, sadece 3 tahta türüne izin verilir', () => {
    render(<AltKonuExercisesFields exercises={[]} onAdd={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByTestId('exercise-form-add')).toBeInTheDocument();
    expect(screen.getByText('onlyBoardFamily: true')).toBeInTheDocument();
    expect(screen.getByText('allowedBoardTypes: click_square,click_piece,move_piece')).toBeInTheDocument();
  });

  it('yeni soru eklenince onAdd çağrılır', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AltKonuExercisesFields exercises={[]} onAdd={onAdd} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByText('test-submit'));
    expect(onAdd).toHaveBeenCalledWith({
      type: 'click_square', instruction: 'test soru', fen: 'x', target_squares: ['e4'],
    });
  });

  it('kayıtlı sorular numaralı kod kartlarıyla listelenir, birine tıklayınca düzenleme formu açılır', () => {
    const exercises: BoardExercise[] = [
      { type: 'click_square', instruction: 'Birinci soru', fen: 'x', target_squares: ['e4'] },
      { type: 'move_piece', instruction: 'İkinci soru', fen: 'x', moves: ['e4'] },
    ];
    render(<AltKonuExercisesFields exercises={exercises} onAdd={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByText('Soru Havuzu'));
    expect(screen.getByText('001')).toBeInTheDocument();
    expect(screen.getByText('002')).toBeInTheDocument();
    expect(screen.queryByTestId('exercise-form-edit')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('001'));
    expect(screen.getByTestId('exercise-form-edit')).toBeInTheDocument();
  });

  it('düzenleme formunda kaydedilince onUpdate doğru index ile çağrılır', () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const exercises: BoardExercise[] = [
      { type: 'click_square', instruction: 'Birinci soru', fen: 'x', target_squares: ['e4'] },
      { type: 'move_piece', instruction: 'İkinci soru', fen: 'x', moves: ['e4'] },
    ];
    render(<AltKonuExercisesFields exercises={exercises} onAdd={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByText('Soru Havuzu'));
    fireEvent.click(screen.getByText('002'));
    fireEvent.click(screen.getByText('test-submit'));
    expect(onUpdate).toHaveBeenCalledWith(1, {
      type: 'click_square', instruction: 'test soru', fen: 'x', target_squares: ['e4'],
    });
  });

  it('Soruyu sil ile onDelete çağrılır ve düzenleme kapanır', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const exercises: BoardExercise[] = [
      { type: 'click_square', instruction: 'Birinci soru', fen: 'x', target_squares: ['e4'] },
    ];
    render(<AltKonuExercisesFields exercises={exercises} onAdd={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Soru Havuzu'));
    fireEvent.click(screen.getByText('001'));
    fireEvent.click(screen.getByText('Soruyu sil'));
    expect(onDelete).toHaveBeenCalledWith(0);
    await waitFor(() => expect(screen.queryByTestId('exercise-form-edit')).not.toBeInTheDocument());
  });
});
