import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoveNotationGrid } from '@/components/analiz/MoveNotationGrid';

describe('MoveNotationGrid (madde 2026-09-03 (5))', () => {
  it('hamle yokken bilgi mesajı gösterir', () => {
    render(<MoveNotationGrid moves={[]} />);
    expect(screen.getByText('Henüz hamle yok.')).toBeInTheDocument();
  });

  it('3\'ten az hamlede numaralar doğru gösterilir', () => {
    render(<MoveNotationGrid moves={[
      { ply: 1, san: 'e4' }, { ply: 2, san: 'e5' }, { ply: 3, san: 'Nf3' },
    ]} />);
    expect(screen.getByText('1. e4')).toBeInTheDocument();
    expect(screen.getByText('e5')).toBeInTheDocument();
    expect(screen.getByText('2. Af3')).toBeInTheDocument();
  });

  it('4. hamle YENİ SATIRA geçer, siyah hamle satır başındaysa "N..." öneki alır', () => {
    render(<MoveNotationGrid moves={[
      { ply: 1, san: 'e4' }, { ply: 2, san: 'e5' }, { ply: 3, san: 'Nf3' }, { ply: 4, san: 'Nc6' },
    ]} />);
    // 4. hamle (siyah, Nc6) yeni satırın İLK hücresi — "2..." öneki almalı.
    expect(screen.getByText('2... Ac6')).toBeInTheDocument();
  });

  it('grid 3 eşit sütunludur (hizalama)', () => {
    const { container } = render(<MoveNotationGrid moves={[{ ply: 1, san: 'e4' }]} />);
    const grid = container.querySelector('.grid') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('Türkçe notasyon uygulanır', () => {
    render(<MoveNotationGrid moves={[{ ply: 1, san: 'Nf3' }]} />);
    expect(screen.getByText('1. Af3')).toBeInTheDocument();
  });

  it('onSelectPly verilmezse hücreler TIKLANAMAZ (buton değil, span)', () => {
    const { container } = render(<MoveNotationGrid moves={[{ ply: 1, san: 'e4' }]} />);
    expect(container.querySelector('button')).toBeNull();
    expect(screen.getByText('1. e4').tagName).toBe('SPAN');
  });

  it('onSelectPly verilirse hücreler tıklanabilir ve doğru ply ile çağrılır', () => {
    const onSelectPly = vi.fn();
    render(<MoveNotationGrid moves={[{ ply: 1, san: 'e4' }, { ply: 2, san: 'e5' }]} onSelectPly={onSelectPly} />);
    fireEvent.click(screen.getByText('e5'));
    expect(onSelectPly).toHaveBeenCalledWith(2);
  });

  it('currentPly verilen hamleyi vurgular', () => {
    render(<MoveNotationGrid moves={[{ ply: 1, san: 'e4' }, { ply: 2, san: 'e5' }]} currentPly={2} onSelectPly={vi.fn()} />);
    expect(screen.getByText('e5')).toHaveStyle({ background: 'rgba(34,211,238,0.25)' });
  });
});
