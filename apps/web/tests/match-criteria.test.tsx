import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchCriteria } from '@/components/play/MatchCriteria';

describe('MatchCriteria', () => {
  it('10 zorluk düzeyi butonu gösterir', () => {
    render(<MatchCriteria onStart={vi.fn()} startLabel="Oyuna Başla" />);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      expect(screen.getByRole('button', { name: `Düzey ${n}` })).toBeInTheDocument();
    }
  });

  it('üç renk seçeneği gösterir', () => {
    render(<MatchCriteria onStart={vi.fn()} startLabel="Oyuna Başla" />);
    expect(screen.getByRole('button', { name: 'Beyaz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rastgele' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siyah' })).toBeInTheDocument();
  });

  it('Süresiz tempo seçeneği YOKTUR (madde g)', () => {
    render(<MatchCriteria onStart={vi.fn()} startLabel="Oyuna Başla" />);
    expect(screen.queryByText(/süresiz/i)).not.toBeInTheDocument();
  });

  it('tempo seçilmeden başlatma butonu devre dışıdır', () => {
    render(<MatchCriteria onStart={vi.fn()} startLabel="Oyuna Başla" />);
    expect(screen.getByRole('button', { name: /Oyuna Başla/ })).toBeDisabled();
  });

  it('düzey+tempo seçilince başlatma butonu aktifleşir ve seçimleri geri verir', () => {
    const onStart = vi.fn();
    render(<MatchCriteria onStart={onStart} startLabel="Oyuna Başla" />);
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 3' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siyah' }));
    const startBtn = screen.getByRole('button', { name: /Oyuna Başla/ });
    expect(startBtn).not.toBeDisabled();
    fireEvent.click(startBtn);
    expect(onStart).toHaveBeenCalledTimes(1);
    const arg = onStart.mock.calls[0][0];
    expect(arg.level.level).toBe(3);
    expect(arg.level.skill).toBe(20);
    expect(arg.timeControl.label).toBe('5+0');
    expect(arg.colorChoice).toBe('black');
  });

  it('varsayılan renk Rastgeledir', () => {
    const onStart = vi.fn();
    render(<MatchCriteria onStart={onStart} startLabel="Oyuna Başla" />);
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 1' }));
    fireEvent.click(screen.getByRole('button', { name: '3+2' }));
    fireEvent.click(screen.getByRole('button', { name: /Oyuna Başla/ }));
    expect(onStart.mock.calls[0][0].colorChoice).toBe('random');
  });

  it('madde 6 (2026-08-20): showRatedMode verilmezse "Oyun Modu" hiç görünmez, rated hep false', () => {
    const onStart = vi.fn();
    render(<MatchCriteria onStart={onStart} startLabel="Oyuna Başla" />);
    expect(screen.queryByText('Oyun Modu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 1' }));
    fireEvent.click(screen.getByRole('button', { name: '3+2' }));
    fireEvent.click(screen.getByRole('button', { name: /Oyuna Başla/ }));
    expect(onStart.mock.calls[0][0].rated).toBe(false);
  });

  it('madde 6: showRatedMode=true iken "Oyun Modu" gösterilir, varsayılan Puanlı', () => {
    const onStart = vi.fn();
    render(<MatchCriteria onStart={onStart} startLabel="Oyuna Başla" showRatedMode />);
    expect(screen.getByText('Oyun Modu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 1' }));
    fireEvent.click(screen.getByRole('button', { name: '3+2' }));
    fireEvent.click(screen.getByRole('button', { name: /Oyuna Başla/ }));
    expect(onStart.mock.calls[0][0].rated).toBe(true);
  });

  it('madde 6: Puansız seçilince rated:false döner', () => {
    const onStart = vi.fn();
    render(<MatchCriteria onStart={onStart} startLabel="Oyuna Başla" showRatedMode />);
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 1' }));
    fireEvent.click(screen.getByRole('button', { name: '3+2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Puansız' }));
    fireEvent.click(screen.getByRole('button', { name: /Oyuna Başla/ }));
    expect(onStart.mock.calls[0][0].rated).toBe(false);
  });
});
