import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchAnalysisSummary } from '@/components/play/MatchAnalysisSummary';

const SUMMARY = {
  inaccuracies: 3, mistakes: 5, blunders: 2, acpl: 92, accuracy: 89,
  phaseAccuracy: { opening: 86, middlegame: 91, endgame: null },
  mistakeMoves: [],
};

/** Madde 2026-09-18: "Kusurlu hamle"/"Hata"/"Vahim hata" etiketleri
 *  SADECE `onSelectSeverity` verilince tıklanabilir olur — BotGame'in
 *  (notasyon listesi olmayan) özet kartında GERİYE DÖNÜK UYUMLU olarak
 *  düz metin kalmalı (tıklanabilir görünüp hiçbir şey yapmamalı). */
describe('MatchAnalysisSummary — kategori seçimi (madde 2026-09-18)', () => {
  it('onSelectSeverity verilmezse etiketler düğme DEĞİLDİR (BotGame ile geriye dönük uyumlu)', () => {
    render(<MatchAnalysisSummary summary={SUMMARY} status="done" onLearnFromMistakes={vi.fn()} />);
    const label = screen.getByText('Kusurlu hamle');
    expect(label.closest('button')).toBeNull();
  });

  it('onSelectSeverity verilirse etiketler tıklanabilir düğme olur, doğru severity ile çağrılır', () => {
    const onSelectSeverity = vi.fn();
    render(
      <MatchAnalysisSummary summary={SUMMARY} status="done" onLearnFromMistakes={vi.fn()}
        selectedSeverity={null} onSelectSeverity={onSelectSeverity} />,
    );
    fireEvent.click(screen.getByText('Kusurlu hamle'));
    expect(onSelectSeverity).toHaveBeenCalledWith('inaccuracy');
    fireEvent.click(screen.getByText('Hata'));
    expect(onSelectSeverity).toHaveBeenCalledWith('mistake');
    fireEvent.click(screen.getByText('Vahim hata'));
    expect(onSelectSeverity).toHaveBeenCalledWith('blunder');
  });

  it('zaten seçili olan kategoriye tekrar tıklayınca null ile çağrılır (toggle kapama)', () => {
    const onSelectSeverity = vi.fn();
    render(
      <MatchAnalysisSummary summary={SUMMARY} status="done" onLearnFromMistakes={vi.fn()}
        selectedSeverity="mistake" onSelectSeverity={onSelectSeverity} />,
    );
    fireEvent.click(screen.getByText('Hata'));
    expect(onSelectSeverity).toHaveBeenCalledWith(null);
  });

  it('"Ortalama santipiyon kaybı" bir kategori DEĞİLDİR — hiçbir zaman düğme olmaz', () => {
    render(
      <MatchAnalysisSummary summary={SUMMARY} status="done" onLearnFromMistakes={vi.fn()}
        onSelectSeverity={vi.fn()} />,
    );
    expect(screen.getByText('Ortalama santipiyon kaybı').closest('button')).toBeNull();
  });
});
