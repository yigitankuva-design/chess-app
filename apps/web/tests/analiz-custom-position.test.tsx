import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { CustomPositionAnalysis } from '@/components/analiz/CustomPositionAnalysis';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

beforeEach(() => {
  push.mockReset();
});

describe('CustomPositionAnalysis', () => {
  it('başlangıçta iki seçenek kartı görünür', () => {
    render(<CustomPositionAnalysis />);
    expect(screen.getByText('Konum Diz')).toBeInTheDocument();
    expect(screen.getByText('FEN Ekle')).toBeInTheDocument();
  });

  it('madde 2026-09-03 (7): Konum Dizerek Ekle → Analiz Et, AYRI SAYFAYA (fen ile) yönlendirir', () => {
    render(<CustomPositionAnalysis />);
    fireEvent.click(screen.getByText('Konum Diz'));
    fireEvent.click(screen.getByText('🔍 Analiz Et'));
    expect(push).toHaveBeenCalledWith(`/analiz/konum/sonuc?fen=${encodeURIComponent(START_FEN)}`);
  });

  it('FEN Ekle: geçersiz FEN\'de kaydet/analiz butonu pasiftir', () => {
    render(<CustomPositionAnalysis />);
    fireEvent.click(screen.getByText('FEN Ekle'));
    fireEvent.change(screen.getByPlaceholderText(/FEN/i), { target: { value: 'saçma metin' } });
    expect(screen.getByText(/geçerli değil/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🔍 Analiz Et' })).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('madde 2026-09-03 (7): FEN Ekle → Analiz Et, AYRI SAYFAYA (fen ile) yönlendirir', () => {
    render(<CustomPositionAnalysis />);
    fireEvent.click(screen.getByText('FEN Ekle'));
    fireEvent.change(screen.getByPlaceholderText(/FEN/i), { target: { value: START_FEN } });
    fireEvent.click(screen.getByRole('button', { name: '🔍 Analiz Et' }));
    expect(push).toHaveBeenCalledWith(`/analiz/konum/sonuc?fen=${encodeURIComponent(START_FEN)}`);
  });
});
