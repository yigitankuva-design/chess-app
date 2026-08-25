import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoveNotationGrid } from '@/components/analiz/MoveNotationGrid';

describe('MoveNotationGrid (madde 2026-09-04 (1c/1d, 3c/3d, 4c/4d))', () => {
  it('hamle yokken bilgi mesajı gösterir', () => {
    render(<MoveNotationGrid moves={[]} />);
    expect(screen.getByText('Henüz hamle yok.')).toBeInTheDocument();
  });

  it('bir TAM hamle (beyaz+siyah) AYNI hücrede, numarasıyla birlikte gösterilir', () => {
    render(<MoveNotationGrid moves={[
      { ply: 1, san: 'e4' }, { ply: 2, san: 'e5' }, { ply: 3, san: 'Nf3' },
    ]} />);
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('e5')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('Af3')).toBeInTheDocument();
  });

  it('bir hamlenin beyaz+siyah kısmı satır sınırında BÖLÜNMEZ (4. ply 4. hamlede)', () => {
    render(<MoveNotationGrid moves={[
      { ply: 1, san: 'e4' }, { ply: 2, san: 'e5' }, { ply: 3, san: 'Nf3' }, { ply: 4, san: 'Nc6' },
    ]} />);
    // "2." numarası TEK BİR YERDE görünür — "2..." diye ayrı bir siyah girişi YOKTUR.
    expect(screen.queryAllByText('2.')).toHaveLength(1);
    expect(screen.queryByText(/2\.\.\./)).not.toBeInTheDocument();
    expect(screen.getByText('Ac6')).toBeInTheDocument();
  });

  it('3 tam hamleden sonra 4. hamle YENİ SATIRA (yeni grid hücresine) geçer', () => {
    const moves = Array.from({ length: 14 }, (_, i) => ({ ply: i + 1, san: 'a3' }));
    const { container } = render(<MoveNotationGrid moves={moves} />);
    // 7 tam hamle (14 ply) → 3'lü satırlara bölününce 3 satır (3+3+1 hamle).
    const cells = container.querySelectorAll('.grid > div');
    expect(cells).toHaveLength(7);
  });

  it('grid 3 eşit sütunludur (hizalama: 1-4-7, 2-5-8, 3-6-9 gibi)', () => {
    const { container } = render(<MoveNotationGrid moves={[{ ply: 1, san: 'e4' }]} />);
    const grid = container.querySelector('.grid') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('Türkçe notasyon uygulanır', () => {
    render(<MoveNotationGrid moves={[{ ply: 1, san: 'Nf3' }]} />);
    expect(screen.getByText('Af3')).toBeInTheDocument();
  });

  it('onSelectPly verilmezse hücreler TIKLANAMAZ (buton değil, span)', () => {
    const { container } = render(<MoveNotationGrid moves={[{ ply: 1, san: 'e4' }]} />);
    expect(container.querySelector('button')).toBeNull();
    expect(screen.getByText('e4').tagName).toBe('SPAN');
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
