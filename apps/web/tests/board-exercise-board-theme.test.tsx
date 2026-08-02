import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const clickSq: BoardExerciseConfig = {
  type: 'click_square', instruction: 'x',
  fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'],
};

describe('BoardExercise — ortak tahta teması + notasyon (madde 1)', () => {
  it('click_square sorusunda KENDİ (dış) rakam/harf çerçevesi görünür', () => {
    // NOT: react-chessboard'un KENDİ varsayılan notasyonu (showNotation=true)
    // zaten kare içinde küçük "8"/"a" metinleri çizer — bu yüzden düz
    // getByText('8') testi YANLIŞ POZİTİF verir (fix olmadan bile geçer).
    // Bunun yerine ChessBoard.tsx ile AYNI dış çerçeve yapısını (data-testid)
    // arıyoruz — bu yalnız BİZİM eklediğimiz markup'ta bulunur.
    render(<BoardExercise exercises={[clickSq]} done={false} onCorrect={vi.fn()} />);
    const frame = screen.getByTestId('board-exercise-coord-frame');
    expect(frame).toBeInTheDocument();
    expect(frame.textContent).toContain('8');
    expect(frame.textContent).toContain('a');
  });

  it('react-chessboard\'un KENDİ iç notasyonu kapatılır (showNotation:false)', () => {
    // Kendi dış çerçevemiz varken kütüphanenin kendi notasyonu da açık
    // kalırsa çift görünür (madde 1'in istediği "tek tip" görünümü bozar).
    const { container } = render(
      <BoardExercise exercises={[clickSq]} done={false} onCorrect={vi.fn()} />,
    );
    // react-chessboard notasyonu kare içinde <span> olarak, data-square
    // öğesinin İÇİNDE render eder — showNotation:false verilince o span'lar
    // hiç oluşmaz.
    const a1 = container.querySelector('[data-square="a1"]') as HTMLElement;
    expect(a1.querySelector('span')).toBeNull();
  });

  it('kareler uygulamanın ortak açık/koyu renklerini kullanır (varsayılan tema)', () => {
    const { container } = render(
      <BoardExercise exercises={[clickSq]} done={false} onCorrect={vi.fn()} />,
    );
    const square = container.querySelector('[data-square="a1"]') as HTMLElement;
    // react-chessboard renk stilini [data-square] elemanının KENDİSİNE
    // uygular (bkz. react-chessboard/dist/index.esm.js Square bileşeni),
    // alt bir div'e değil. BOARD_DARK_SQUARE = '#c3c6ee' (boardSkin.tsx).
    // happy-dom hex'i rgb'ye normalize etmez, ham değer kalır.
    expect(square.style.backgroundColor).toBe('#c3c6ee');
  });
});
