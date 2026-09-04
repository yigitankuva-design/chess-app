import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameHistoryList } from '@/components/analiz/GameHistoryList';
import type { GameSummary } from '@/lib/analiz/analizApi';

function game(over: Partial<GameSummary> = {}): GameSummary {
  return {
    id: 1, type: 'bot', result: '1-0', student_color: 'w',
    started_at: '2026-08-30T10:00:00', finished_at: '2026-08-30T10:20:00',
    opponent: { type: 'bot', level: 4 }, start_fen: null,
    white_name: 'Ali', black_name: 'Bot · Düzey 4', rated: false,
    white_rating_after: null, black_rating_after: null,
    white_rating_delta: null, black_rating_delta: null,
    tempo_label: null, opening_name: null, variant_name: null,
    ...over,
  };
}

describe('GameHistoryList', () => {
  it('yüklenirken mesaj gösterir', () => {
    render(<GameHistoryList games={[]} loading onSelect={vi.fn()} />);
    expect(screen.getByText('Yükleniyor…')).toBeInTheDocument();
  });

  it('liste boşken bilgi mesajı gösterir', () => {
    render(<GameHistoryList games={[]} loading={false} onSelect={vi.fn()} />);
    expect(screen.getByText('Henüz bitmiş bir maçın yok.')).toBeInTheDocument();
  });

  it('madde 2026-09-06 (ikinci tur/E): beyaz — skor — siyah — tempo/tarih — açılış/varyant TEK SATIRDA', () => {
    render(<GameHistoryList games={[game({
      white_name: 'Ali', black_name: 'Zeynep', tempo_label: '5+3(Yıldırım)',
      opening_name: 'İspanyol Açılışı', variant_name: 'Berlin Defansı',
    })]} loading={false} onSelect={vi.fn()} />);
    expect(screen.getByText('Ali')).toBeInTheDocument();
    expect(screen.getByText('1-0')).toBeInTheDocument();
    expect(screen.getByText('Zeynep')).toBeInTheDocument();
    expect(screen.getByText('5+3(Yıldırım) 30.08.2026')).toBeInTheDocument();
    expect(screen.getByText('İspanyol Açılışı — Berlin Defansı')).toBeInTheDocument();
    // Hepsi AYNI satırda (sarma yok) — tek bir wrapper div içinde duruyor.
    const row = screen.getByText('Ali').closest('div');
    expect(row?.className).toContain('whitespace-nowrap');
    expect(row).toHaveTextContent('Ali|1-0|Zeynep|5+3(Yıldırım) 30.08.2026|İspanyol Açılışı — Berlin Defansı');
  });

  it('puanlı maçta isimlerin yanında maç-sonrası puan ve fark gösterilir', () => {
    render(<GameHistoryList games={[game({
      white_name: 'Anonymous008', black_name: 'zfrdnc25', rated: true,
      white_rating_after: 2095, white_rating_delta: 6,
      black_rating_after: 2092, black_rating_delta: -5,
    })]} loading={false} onSelect={vi.fn()} />);
    expect(screen.getByText('Anonymous008 2095+6')).toBeInTheDocument();
    expect(screen.getByText('zfrdnc25 2092−5')).toBeInTheDocument();
  });

  it('puansız/bot maçında isimler çıplak (puan eki YOK) gösterilir', () => {
    render(<GameHistoryList games={[game()]} loading={false} onSelect={vi.fn()} />);
    expect(screen.getByText('Ali')).toBeInTheDocument();
    expect(screen.getByText('Bot · Düzey 4')).toBeInTheDocument();
  });

  it('açılış/varyant eşleşmeyen maçta o satır hiç render edilmez', () => {
    render(<GameHistoryList games={[game({ opening_name: null, variant_name: null })]}
      loading={false} onSelect={vi.fn()} />);
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it('tempo yoksa (süresiz) "Süresiz" gösterir', () => {
    render(<GameHistoryList games={[game({ tempo_label: null })]} loading={false} onSelect={vi.fn()} />);
    expect(screen.getByText(/^Süresiz /)).toBeInTheDocument();
  });

  it('karta tıklayınca onSelect o maçla çağrılır', () => {
    const onSelect = vi.fn();
    const g = game();
    render(<GameHistoryList games={[g]} loading={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Ali'));
    expect(onSelect).toHaveBeenCalledWith(g);
  });
});
