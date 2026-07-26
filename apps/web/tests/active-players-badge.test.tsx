import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ActivePlayersBadge, activeColor, ACTIVE_GREEN, INACTIVE_RED,
} from '@/components/play/ActivePlayersBadge';

describe('activeColor', () => {
  it('sıfırda kırmızı döner', () => {
    expect(activeColor(0)).toBe(INACTIVE_RED);
  });

  it('sıfırdan büyükte yeşil döner', () => {
    expect(activeColor(1)).toBe(ACTIVE_GREEN);
    expect(activeColor(45)).toBe(ACTIVE_GREEN);
  });
});

describe('ActivePlayersBadge', () => {
  it('sayıyı gösterir', () => {
    render(<ActivePlayersBadge count={7} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('sıfırı da gösterir', () => {
    render(<ActivePlayersBadge count={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('sayı > 0 iken yeşil arka plan kullanır', () => {
    render(<ActivePlayersBadge count={3} />);
    const el = screen.getByText('3');
    expect(el.style.backgroundColor).not.toBe('');
    expect(el.getAttribute('data-active')).toBe('true');
  });

  it('sayı 0 iken kırmızı ve data-active false olur', () => {
    render(<ActivePlayersBadge count={0} />);
    expect(screen.getByText('0').getAttribute('data-active')).toBe('false');
  });

  it('ekran okuyucu için anlamlı etiket taşır', () => {
    render(<ActivePlayersBadge count={5} />);
    expect(screen.getByLabelText('5 aktif sporcu')).toBeInTheDocument();
  });
});
