import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoveList } from '@/components/play/MoveList';

/** Metni bosluk/satir farklarindan bagimsiz okur — yan yana akan yazimda
 *  DOM birden cok <span>'a boluyor. */
function notation(): string {
  return screen.getByLabelText('Hamleler').textContent!
    .replace(/\s+/g, ' ')
    .replace(/^\s*Hamleler\s*/, '')   // bolum basligi karsilastirmaya girmez
    .trim();
}

describe('MoveList — tahta altındaki notasyon (madde 1/3)', () => {
  it('hamle yokken bilgilendirir', () => {
    render(<MoveList san={[]} />);
    expect(screen.getByText('Henüz hamle yapılmadı.')).toBeInTheDocument();
  });

  it('hamleler YAN YANA, virgülle ayrılmış ve TÜRKÇE yazılır', () => {
    render(<MoveList san={['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']} />);
    expect(notation()).toBe('1. e4 – e5, 2. Af3 – Ac6, 3. Fc4 – Fc5');
  });

  it('tek hamlede tire yazılmaz', () => {
    render(<MoveList san={['e4']} />);
    expect(notation()).toBe('1. e4');
  });

  it('açılış konumundan başlayan maçta numara FEN’den devam eder', () => {
    render(
      <MoveList
        san={['Nf6']}
        startFen="r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 3"
      />,
    );
    expect(notation()).toBe('3. … – Af6');
  });
});

describe('MoveList — satır sonunda alt satıra iner', () => {
  it('TUZAK: ayırıcı BÖLÜNMEZ BOŞLUK olmamalı', () => {
    // Once ', ' kullaniliyordu; nowrap ile birlesince satir HIC
    // bolunmuyor ve notasyon yatay olarak akip gidiyordu.
    render(<MoveList san={['e4', 'e5', 'Nf3', 'Nc6']} />);
    const metin = screen.getByLabelText('Hamleler').textContent!;
    expect(metin).not.toContain(' ');
    expect(metin).toContain(', ');
  });

  it('her hamle çifti kendi içinde bölünmez, ayırıcı boşluk dışarıda kalır', () => {
    render(<MoveList san={['e4', 'e5', 'Nf3', 'Nc6']} />);
    const nowrap = screen.getByLabelText('Hamleler')
      .querySelectorAll('.whitespace-nowrap');
    expect(nowrap).toHaveLength(2);                 // iki hamle cifti
    expect(nowrap[0].textContent).toBe('1. e4 – e5,');
    expect(nowrap[0].textContent).not.toMatch(/ $/); // bosluk icinde DEGIL
  });

  it('notasyon kartı tahtayla aynı genişlikte sınırlanır', () => {
    render(<MoveList san={['e4']} />);
    expect(screen.getByLabelText('Hamleler').className).toContain('max-w-[600px]');
  });
});
