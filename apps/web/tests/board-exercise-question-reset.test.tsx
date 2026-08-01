import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

// NEDEN STUB: gerçek react-chessboard, taş animasyonu için kareden
// getBoundingClientRect().width okur; happy-dom'da layout olmadığı için pozisyon
// değişince "Square width not found" fırlatır. Bu testte incelenen şey tahta çizimi
// DEĞİL, soru geçişinde çözücü durumunun sıfırlanması. Bu yüzden tahtayı
// tıkla-seç → tıkla-oyna davranışını birebir taşıyan sade bir stub'la değiştiriyoruz.
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({
    interactive,
    onPieceDrop,
  }: {
    interactive?: boolean;
    onPieceDrop?: (from: string, to: string) => boolean;
  }) => {
    const [sel, setSel] = useState<string | null>(null);
    const squares = ['f4', 'h4', 'f5', 'f8', 'h8', 'g8'];
    return (
      <div>
        {squares.map((sq) => (
          <button
            key={sq}
            data-square={sq}
            onClick={() => {
              if (!interactive) return;
              if (sel === null) { setSel(sq); return; }
              onPieceDrop?.(sel, sq);
              setSel(null);
            }}
          />
        ))}
      </div>
    );
  },
}));

const q1: BoardExerciseConfig = {
  type: 'move_piece',
  instruction: 'Soru 1',
  fen: '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1',
  moves: ['Rh4', 'Kf8'], // SAN'lar chess.js ile doğrulandı
};
const q2: BoardExerciseConfig = {
  type: 'move_piece',
  instruction: 'Soru 2',
  fen: '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1',
  moves: ['Rf5', 'Kh8'], // farklı ilk hamle — SAN'lar doğrulandı
};

describe('BoardExercise — soru geçişinde çözücü durumu sıfırlanır', () => {
  it('2. sorunun doğru hamlesi yanlış sayılmaz (canlıda bulunan hata)', async () => {
    // CANLIDA BULUNAN HATA: MovePieceSolver oynanan hamleleri kendi state'inde tutuyor.
    // key olmadan React soru değişince aynı örneği yeniden kullanır → 1. sorunun
    // hamleleri 2. soruya taşınır → doğru hamle "yanlış" sayılır ve bölüm biter.
    const onCorrect = vi.fn();
    const { container } = render(
      <BoardExercise exercises={[q1, q2]} done={false} onCorrect={onCorrect} />,
    );
    const click = (sq: string) =>
      fireEvent.click(container.querySelector(`[data-square="${sq}"]`)!);

    // Soru 1: Rh4 → rakip cevap anahtarından Kf8 oynar → soru tamamlanır
    click('f4');
    click('h4');
    await waitFor(() => expect(screen.getByText('Sonraki Soruya Geç')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Sonraki Soruya Geç'));

    // Soru 2: kendi ilk hamlesi (Rf5) KABUL EDİLMELİ
    click('f4');
    click('f5');
    // Doğru geri bildirim gelmeli; "tüm sorular cevaplandı" (= yanlış sayıldı) ekranı GELMEMELİ.
    // onCorrect dizi sonunda ve yalnız tüm sorular doğruysa bir kez çağrılır.
    await waitFor(() => expect(onCorrect).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/tüm sorular cevaplandı/i)).not.toBeInTheDocument();
  });
});
