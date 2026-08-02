import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

/**
 * NEDEN BURADA KARE STİLİ TEST EDİLMİYOR
 *
 * react-chessboard 5.10 `squareStyles`'ı `[data-square]` elemanının içindeki
 * div'e uygular. İLK render'daki stiller (ör. ipucu kareleri) test ortamında
 * DOM'a yansıyor, ama tıklamadan SONRA değişen stiller happy-dom'da yansımıyor
 * (ölçüldü: bileşen `styles`'ı doğru hesaplıyor — `{a1: {...}}` — fakat iç div
 * güncellenmiyor).
 *
 * Gerçek tarayıcıda ÇALIŞIYOR: bu oturumda localhost'ta ölçüldü — a1 ve b2'ye
 * tıklandığında ikisi de mavi halka aldı, üçüncü karede soru doğru bitti.
 *
 * Bu yüzden burada DAVRANIŞ test edilir; halkanın kendisi `ringStyle` birim
 * testleriyle (tests/square-marker.test.ts) ve gerçek tarayıcı doğrulamasıyla
 * güvence altındadır.
 */

const multiEx: BoardExerciseConfig = {
  type: 'click_square',
  instruction: 'Üç kareye de tıkla',
  fen: '8/8/8/8/8/8/8/8 w - - 0 1',
  target_squares: ['a1', 'b2', 'c3'],
  click_mode: 'all',
};

/** İkinci soru: yanlış cevap sonrası geribildirim kartının görünmesi için
 *  oturumun BİTMEMESİ gerekiyor (son soruda kart yerine bitiş ekranı çıkar). */
const ikinciEx: BoardExerciseConfig = {
  type: 'click_square',
  instruction: 'İkinci soru',
  fen: '8/8/8/8/8/8/8/8 w - - 0 1',
  target_squares: ['d4'],
};

function renderEx(list: BoardExerciseConfig[]) {
  return render(<BoardExercise exercises={list} done={false} onCorrect={vi.fn()} />);
}

describe('BoardExercise — çoklu kare cevabı', () => {
  it('iki doğru tıklamadan sonra soru HENÜZ bitmez', () => {
    const { container } = renderEx([multiEx, ikinciEx]);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(container.querySelector('[data-square="b2"]')!);
    expect(screen.queryByLabelText('Doğru')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Yanlış')).not.toBeInTheDocument();
  });

  it('üçüncü doğru tıklamada soru DOĞRU biter', () => {
    const { container } = renderEx([multiEx, ikinciEx]);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(container.querySelector('[data-square="b2"]')!);
    fireEvent.click(container.querySelector('[data-square="c3"]')!);
    expect(screen.getByLabelText('Doğru')).toBeInTheDocument();
  });

  it('yanlış kareye tıklanınca soru YANLIŞ olur (tek hak)', () => {
    const { container } = renderEx([multiEx, ikinciEx]);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(container.querySelector('[data-square="h8"]')!);
    expect(screen.getByLabelText('Yanlış')).toBeInTheDocument();
  });
});

describe('BoardExercise — geribildirim kartında yazı yok', () => {
  it('doğru cevapta kartta SADECE işaret vardır, "Aferin" metni YOKTUR', () => {
    const { container } = renderEx([multiEx, ikinciEx]);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(container.querySelector('[data-square="b2"]')!);
    fireEvent.click(container.querySelector('[data-square="c3"]')!);
    expect(screen.getByLabelText('Doğru').textContent).toBe('✓');
    expect(container.textContent).not.toMatch(/Aferin/);
  });

  it('yanlış cevapta kartta özel fail metni GÖRÜNMEZ', () => {
    const failEx: BoardExerciseConfig = {
      ...multiEx, fail_msg: 'BURASI GORUNMEMELI',
    };
    const { container } = renderEx([failEx, ikinciEx]);
    fireEvent.click(container.querySelector('[data-square="h8"]')!);
    expect(screen.getByLabelText('Yanlış')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/BURASI GORUNMEMELI/);
  });
});
