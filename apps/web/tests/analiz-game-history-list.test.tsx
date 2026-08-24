import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameHistoryList } from '@/components/analiz/GameHistoryList';
import type { GameSummary } from '@/lib/analiz/analizApi';

function game(over: Partial<GameSummary> = {}): GameSummary {
  return {
    id: 1, type: 'bot', result: '1-0', student_color: 'w',
    started_at: '2026-08-30T10:00:00', finished_at: '2026-08-30T10:20:00',
    opponent: { type: 'bot', level: 4 }, start_fen: null,
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

  it('sporcu kazandıysa ✅, bot düzeyi gösterir', () => {
    render(<GameHistoryList games={[game()]} loading={false} onSelect={vi.fn()} />);
    expect(screen.getByText('✅')).toBeInTheDocument();
    expect(screen.getByText('Bot · Düzey 4')).toBeInTheDocument();
  });

  it('sporcu kaybettiyse ❌ gösterir', () => {
    render(<GameHistoryList games={[game({ result: '0-1', student_color: 'w' })]} loading={false} onSelect={vi.fn()} />);
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('beraberlikte 🤝 gösterir', () => {
    render(<GameHistoryList games={[game({ result: '1/2-1/2' })]} loading={false} onSelect={vi.fn()} />);
    expect(screen.getByText('🤝')).toBeInTheDocument();
  });

  it('insan rakip adını gösterir', () => {
    render(<GameHistoryList games={[game({ type: 'human', opponent: { type: 'human', name: 'Zeynep' } })]} loading={false} onSelect={vi.fn()} />);
    expect(screen.getByText('Zeynep')).toBeInTheDocument();
  });

  it('karta tıklayınca onSelect o maçla çağrılır', () => {
    const onSelect = vi.fn();
    const g = game();
    render(<GameHistoryList games={[g]} loading={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Bot · Düzey 4'));
    expect(onSelect).toHaveBeenCalledWith(g);
  });
});
