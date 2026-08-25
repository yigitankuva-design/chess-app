import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { AnalizPanel } from '@/components/analiz/AnalizPanel';

describe('AnalizPanel — madde 2026-09-02: her alt sekme AYRI SAYFAYA gider', () => {
  it('3 alt sekme, sıralama: Yeni Analiz, Maçlarımın Analizi, Konum Analizi', () => {
    render(<AnalizPanel />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Yeni Analiz', 'Maçlarımın Analizi', 'Konum Analizi',
    ]);
  });

  it('"Yeni Analiz" tıklanınca /analiz/yeni\'ye yönlendirir', () => {
    render(<AnalizPanel />);
    fireEvent.click(screen.getByText('Yeni Analiz'));
    expect(push).toHaveBeenCalledWith('/analiz/yeni');
  });

  it('"Maçlarımın Analizi" tıklanınca /analiz/maclarim\'e yönlendirir', () => {
    render(<AnalizPanel />);
    fireEvent.click(screen.getByText('Maçlarımın Analizi'));
    expect(push).toHaveBeenCalledWith('/analiz/maclarim');
  });

  it('"Konum Analizi" tıklanınca /analiz/konum\'a yönlendirir', () => {
    render(<AnalizPanel />);
    fireEvent.click(screen.getByText('Konum Analizi'));
    expect(push).toHaveBeenCalledWith('/analiz/konum');
  });

  it('alt sekme satırlarında ikon YOK (yalnızca metin butonlar)', () => {
    render(<AnalizPanel />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((b) => expect(b.querySelector('svg, img')).toBeNull());
  });
});
