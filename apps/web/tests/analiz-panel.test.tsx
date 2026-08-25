import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/analiz/GameAnalysisSection', () => ({
  GameAnalysisSection: () => <div data-testid="game-analysis-section" />,
}));
vi.mock('@/components/analiz/CustomPositionAnalysis', () => ({
  CustomPositionAnalysis: () => <div data-testid="custom-position-analysis" />,
}));

import { AnalizPanel } from '@/components/analiz/AnalizPanel';

describe('AnalizPanel — madde 2026-09-01', () => {
  it('3 alt sekme, sıralama: Yeni Analiz, Maçlarımın Analizi, Konum Analizi', () => {
    render(<AnalizPanel />);
    const labels = ['Yeni Analiz', 'Maçlarımın Analizi', 'Konum Analizi'];
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(labels);
  });

  it('hiçbiri açık değilken içerik gösterilmez', () => {
    render(<AnalizPanel />);
    expect(screen.queryByTestId('game-analysis-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('custom-position-analysis')).not.toBeInTheDocument();
  });

  it('"Yeni Analiz" açılınca GameAnalysisSection gösterilir', () => {
    render(<AnalizPanel />);
    fireEvent.click(screen.getByText('Yeni Analiz'));
    expect(screen.getByTestId('game-analysis-section')).toBeInTheDocument();
  });

  it('"Maçlarımın Analizi" açılınca da GameAnalysisSection gösterilir (aynı tasarım)', () => {
    render(<AnalizPanel />);
    fireEvent.click(screen.getByText('Maçlarımın Analizi'));
    expect(screen.getByTestId('game-analysis-section')).toBeInTheDocument();
  });

  it('"Konum Analizi" açılınca CustomPositionAnalysis gösterilir', () => {
    render(<AnalizPanel />);
    fireEvent.click(screen.getByText('Konum Analizi'));
    expect(screen.getByTestId('custom-position-analysis')).toBeInTheDocument();
  });

  it('bir alt sekme açıkken başka birine tıklayınca öncekini kapatır (tek seferde biri açık)', () => {
    render(<AnalizPanel />);
    fireEvent.click(screen.getByText('Yeni Analiz'));
    expect(screen.getByTestId('game-analysis-section')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Konum Analizi'));
    expect(screen.getByTestId('custom-position-analysis')).toBeInTheDocument();
    // Yeni Analiz'in içeriği artık YOK (yalnızca bir tane game-analysis-section render edilebilir zaten).
    expect(screen.queryAllByTestId('game-analysis-section')).toHaveLength(0);
  });

  it('açık bir sekmeye tekrar tıklayınca kapanır', () => {
    render(<AnalizPanel />);
    fireEvent.click(screen.getByText('Konum Analizi'));
    expect(screen.getByTestId('custom-position-analysis')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Konum Analizi'));
    expect(screen.queryByTestId('custom-position-analysis')).not.toBeInTheDocument();
  });

  it('alt sekme satırlarında ikon YOK (yalnızca metin butonlar)', () => {
    render(<AnalizPanel />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((b) => expect(b.querySelector('svg, img')).toBeNull());
  });
});
