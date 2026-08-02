import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoveList } from '@/components/play/MoveList';

describe('MoveList — hamleye tıklayarak gezinme (madde 1)', () => {
  it('onSelectPly verilmezse hamleler DÜZ METİN kalır (eski davranış)', () => {
    render(<MoveList san={['e4', 'e5']} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('onSelectPly verilirse her hamle ayrı ayrı tıklanabilir', () => {
    render(<MoveList san={['e4', 'e5']} onSelectPly={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'e4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'e5' })).toBeInTheDocument();
  });

  it('beyazın 1. hamlesine tıklayınca ply 1 bildirilir', () => {
    const onSelect = vi.fn();
    render(<MoveList san={['e4', 'e5', 'Nf3']} onSelectPly={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'e4' }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('siyahın 2. hamlesine tıklayınca ply 4 bildirilir', () => {
    const onSelect = vi.fn();
    render(<MoveList san={['e4', 'e5', 'Nf3', 'Nc6']} onSelectPly={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ac6' }));
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it('aktif hamle işaretlenir', () => {
    render(<MoveList san={['e4', 'e5']} onSelectPly={vi.fn()} activePly={2} />);
    expect(screen.getByRole('button', { name: 'e5' }))
      .toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'e4' }))
      .not.toHaveAttribute('aria-current');
  });

  it('tıklanabilir haldeyken de yazım aynı kalır (Türkçe, virgüllü)', () => {
    render(<MoveList san={['e4', 'e5', 'Nf3', 'Nc6']} onSelectPly={vi.fn()} />);
    const metin = screen.getByLabelText('Hamleler').textContent!
      .replace(/\s+/g, ' ').replace(/^\s*Hamleler\s*/, '').trim();
    expect(metin).toBe('1. e4 – e5, 2. Af3 – Ac6');
  });
});
