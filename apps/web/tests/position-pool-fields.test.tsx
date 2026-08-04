import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PositionPoolFields } from '@/components/admin/PositionPoolFields';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('PositionPoolFields', () => {
  it('Konumu Kaydet tıklanınca onSavePosition çağrılır', () => {
    const onSavePosition = vi.fn();
    render(
      <PositionPoolFields
        fen={START_FEN} turn="w"
        onFenChange={() => {}} onTurnChange={() => {}}
        onSavePosition={onSavePosition}
        pool={[]} onDeletePosition={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    expect(onSavePosition).toHaveBeenCalled();
  });

  it('havuzdaki her konum için Sil butonu gösterir', () => {
    const onDeletePosition = vi.fn();
    render(
      <PositionPoolFields
        fen={START_FEN} turn="w"
        onFenChange={() => {}} onTurnChange={() => {}}
        onSavePosition={() => {}}
        pool={[{ id: 'p1', fen: START_FEN }, { id: 'p2', fen: START_FEN }]}
        onDeletePosition={onDeletePosition}
      />,
    );
    const delButtons = screen.getAllByText('Sil');
    expect(delButtons).toHaveLength(2);
    fireEvent.click(delButtons[0]);
    expect(onDeletePosition).toHaveBeenCalledWith('p1');
  });

  it('havuz boşsa bilgi metni gösterir', () => {
    render(
      <PositionPoolFields
        fen={START_FEN} turn="w"
        onFenChange={() => {}} onTurnChange={() => {}}
        onSavePosition={() => {}}
        pool={[]} onDeletePosition={() => {}}
      />,
    );
    expect(screen.getByText(/Henüz konum eklenmedi/)).toBeInTheDocument();
  });
});
