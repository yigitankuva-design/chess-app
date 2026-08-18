import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchCriteria } from '@/components/play/MatchCriteria';

describe('MatchCriteria — simplifiedLevels (Pratik Yap: Kolay/Orta/Zor)', () => {
  it('simplifiedLevels=false (varsayılan) iken 10 düzey butonu gösterir', () => {
    render(<MatchCriteria onStart={vi.fn()} startLabel="Başla" />);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      expect(screen.getByRole('button', { name: `Düzey ${n}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Kolay' })).not.toBeInTheDocument();
  });

  it('simplifiedLevels=true iken sadece Kolay/Orta/Zor gösterir, eski 10 düzey YOKTUR', () => {
    render(<MatchCriteria onStart={vi.fn()} startLabel="Başla" simplifiedLevels />);
    expect(screen.getByRole('button', { name: 'Kolay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Orta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zor' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Düzey 1' })).not.toBeInTheDocument();
  });

  it('Kolay seçilince eski düzey 1 gönderilir', () => {
    const onStart = vi.fn();
    render(<MatchCriteria onStart={onStart} startLabel="Başla" simplifiedLevels />);
    fireEvent.click(screen.getByRole('button', { name: 'Kolay' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Başla/ }));
    expect(onStart.mock.calls[0][0].level.level).toBe(1);
  });

  it('Orta seçilince eski düzey 5 gönderilir', () => {
    const onStart = vi.fn();
    render(<MatchCriteria onStart={onStart} startLabel="Başla" simplifiedLevels />);
    fireEvent.click(screen.getByRole('button', { name: 'Orta' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Başla/ }));
    expect(onStart.mock.calls[0][0].level.level).toBe(5);
  });

  it('Zor seçilince eski düzey 10 gönderilir', () => {
    const onStart = vi.fn();
    render(<MatchCriteria onStart={onStart} startLabel="Başla" simplifiedLevels />);
    fireEvent.click(screen.getByRole('button', { name: 'Zor' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Başla/ }));
    expect(onStart.mock.calls[0][0].level.level).toBe(10);
  });
});
