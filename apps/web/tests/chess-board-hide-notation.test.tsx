import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChessBoard } from '@/components/ChessBoard';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('ChessBoard — hideNotation (madde 3)', () => {
  it('varsayılan (verilmezse) rakam ve harf etiketleri GÖRÜNÜR', () => {
    render(<ChessBoard fen={FEN} />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('h')).toBeInTheDocument();
  });

  it('hideNotation=true iken rakam ve harf etiketleri HİÇ render edilmez', () => {
    render(<ChessBoard fen={FEN} hideNotation />);
    expect(screen.queryByText('8')).not.toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('a')).not.toBeInTheDocument();
    expect(screen.queryByText('h')).not.toBeInTheDocument();
  });

  it('hideNotation=false açıkça verilse de etiketler görünür (varsayılanla aynı)', () => {
    render(<ChessBoard fen={FEN} hideNotation={false} />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
  });
});
