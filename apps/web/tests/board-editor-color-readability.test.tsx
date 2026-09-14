import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardEditor } from '@/components/BoardEditor';

/**
 * Madde 2026-09-14 (madde 1): "Başlangıç konumu", "Tahtayı temizle",
 * "Beyaz", "Siyah" butonları sabit `text-white/NN` (her zaman beyaz metin)
 * kullanıyordu — açık temalarda (uygulamanın varsayılanı dahil) beyaz
 * zeminde beyaz metin okunmuyordu. Artık tema-duyarlı `var(--t-text-1)`/
 * `var(--t-border)` kullanılıyor.
 */
function setup(fen = '8/8/8/8/8/8/8/8 w - - 0 1', paletteLayout?: 'side' | 'split') {
  return render(
    <BoardEditor fen={fen} turn="w" onChange={vi.fn()} onTurnChange={vi.fn()} paletteLayout={paletteLayout} />,
  );
}

describe('BoardEditor — okunmayan metinlerin rengi düzeltildi (madde 1)', () => {
  it('side düzeninde "Başlangıç konumu"/"Tahtayı temizle" artık sabit beyaz DEĞİL', () => {
    setup();
    expect(screen.getByText('Başlangıç konumu').className).not.toMatch(/text-white/);
    expect(screen.getByText('Tahtayı temizle').className).not.toMatch(/text-white/);
  });

  it('side düzeninde pasif "Beyaz"/"Siyah" butonları artık sabit beyaz DEĞİL', () => {
    setup();
    // turn="w" olduğu için "Siyah" pasif (seçili olmayan) durumdadır.
    expect(screen.getByText('Siyah').className).not.toMatch(/text-white\/70/);
  });

  it('split düzeninde de aynı düzeltme geçerli', () => {
    setup(undefined, 'split');
    expect(screen.getByText('Başlangıç konumu').className).not.toMatch(/text-white/);
    expect(screen.getByText('Siyah').className).not.toMatch(/text-white\/70/);
  });
});
