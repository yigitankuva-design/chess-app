import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchCriteria } from '@/components/play/MatchCriteria';

describe('MatchCriteria — üç yatay sıra (madde 5)', () => {
  it('1. sırada 10 dairesel düzey kartı vardır, üzerlerinde sadece rakam', () => {
    render(<MatchCriteria startLabel="Maça Başla" onStart={vi.fn()} />);
    for (let n = 1; n <= 10; n++) {
      const btn = screen.getByRole('button', { name: `Düzey ${n}` });
      expect(btn).toHaveTextContent(String(n));
    }
  });

  it('TUZAK: düzey varsayılan olarak SEÇİLİ DEĞİLDİR', () => {
    // Eski kodda LEVELS[0] varsayilandi; oyle olsaydi sirali kilit
    // daha basta acilmis olurdu.
    render(<MatchCriteria startLabel="Maça Başla" onStart={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Maça Başla/ })).toBeDisabled();
  });

  it('düzey seçilmeden tempo satırı kilitlidir', () => {
    render(<MatchCriteria startLabel="Maça Başla" onStart={vi.fn()} />);
    const tempoRow = screen.getByText('Tempo ve Süre Seç', { exact: false }).closest('div');
    expect(tempoRow).toHaveAttribute('aria-disabled', 'true');
  });

  it('düzey seçilince tempo satırı açılır', () => {
    render(<MatchCriteria startLabel="Maça Başla" onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 3' }));
    const tempoRow = screen.getByText('Tempo ve Süre Seç', { exact: false }).closest('div');
    expect(tempoRow).toHaveAttribute('aria-disabled', 'false');
  });

  it('a-b-c sırayla tamamlanınca seçilen değerlerle başlar', () => {
    const onStart = vi.fn();
    render(<MatchCriteria startLabel="Maça Başla" onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 5' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siyah' }));
    fireEvent.click(screen.getByRole('button', { name: /Maça Başla/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
    const v = onStart.mock.calls[0][0];
    expect(v.level.level).toBe(5);
    expect(v.timeControl.label).toBe('5+0');
    expect(v.colorChoice).toBe('black');
  });
});

describe('MatchCriteria — showLevel=false (madde 7)', () => {
  it('Düzey satırı HİÇ çizilmez', () => {
    render(<MatchCriteria showLevel={false} startLabel="Kriterleri Onayla" onStart={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Düzey 1' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Düzey Seç/)).not.toBeInTheDocument();
  });

  it('Tempo-Süre-Renk seçenekleri DURUR', () => {
    render(<MatchCriteria showLevel={false} startLabel="Kriterleri Onayla" onStart={vi.fn()} />);
    expect(screen.getByRole('button', { name: '5+0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beyaz' })).toBeInTheDocument();
  });

  it('düzey olmadan tempo seçilir seçilmez başlatılabilir', () => {
    const onStart = vi.fn();
    render(<MatchCriteria showLevel={false} startLabel="Kriterleri Onayla" onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: '10+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Kriterleri Onayla/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
    // Duzey gonderilmeye devam eder (cagiranlar kirilmasin) — varsayilan 1.
    expect(onStart.mock.calls[0][0].level.level).toBe(1);
  });
});
