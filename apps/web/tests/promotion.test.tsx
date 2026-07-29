import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { isPromotionMove, promotionFromUci, toUci } from '@/lib/play/promotion';
import { PromotionPicker } from '@/components/play/PromotionPicker';

describe('promotion — saf mantık (madde 2)', () => {
  it('beyaz piyon 8. sıraya varınca terfidir', () => {
    expect(isPromotionMove({ type: 'p', color: 'w' }, 'e8')).toBe(true);
  });

  it('siyah piyon 1. sıraya varınca terfidir', () => {
    expect(isPromotionMove({ type: 'p', color: 'b' }, 'e1')).toBe(true);
  });

  it('TUZAK: beyaz piyonun 1. sıraya inmesi terfi DEĞİLDİR', () => {
    expect(isPromotionMove({ type: 'p', color: 'w' }, 'e1')).toBe(false);
  });

  it('piyon olmayan taş son sıraya gitse de terfi değildir', () => {
    expect(isPromotionMove({ type: 'r', color: 'w' }, 'e8')).toBe(false);
    expect(isPromotionMove(null, 'e8')).toBe(false);
  });

  it('UCI’deki terfi harfi okunur; yoksa vezir VARSAYILMAZ', () => {
    expect(promotionFromUci('e7e8n')).toBe('n');
    expect(promotionFromUci('e7e8Q')).toBe('q');
    expect(promotionFromUci('e2e4')).toBeUndefined();
  });

  it('toUci terfi harfini ekler', () => {
    expect(toUci('e7', 'e8', 'r')).toBe('e7e8r');
    expect(toUci('e2', 'e4')).toBe('e2e4');
  });
});

describe('PromotionPicker — seçim penceresi', () => {
  it('dört taş da sunulur', () => {
    render(<PromotionPicker onPick={vi.fn()} onCancel={vi.fn()} />);
    for (const label of ['Vezir', 'Kale', 'Fil', 'At']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('seçilen taş geri bildirilir', () => {
    const onPick = vi.fn();
    render(<PromotionPicker onPick={onPick} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'At' }));
    expect(onPick).toHaveBeenCalledWith('n');
  });

  it('vazgeçilebilir', () => {
    const onCancel = vi.fn();
    render(<PromotionPicker onPick={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
