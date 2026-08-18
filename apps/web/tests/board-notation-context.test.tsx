import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { BoardNotationProvider, useBoardNotation } from '@/lib/board-notation-context';
import { ChessBoard } from '@/components/ChessBoard';
import { MoveList } from '@/components/play/MoveList';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** BotGame/LiveGame'in yaptığı gibi: context'i okuyup ChessBoard'a geçirir. */
function BoardConsumer() {
  const { hideNotation } = useBoardNotation();
  return <ChessBoard fen={FEN} hideNotation={hideNotation} />;
}

function Screen() {
  return (
    <BoardNotationProvider>
      <BoardConsumer />
      <MoveList san={['e4']} />
    </BoardNotationProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('BoardNotationProvider — "Notasyon Verilerini Gizle" (madde 3)', () => {
  it('varsayılan: notasyon açık, tahta etiketleri görünür', async () => {
    render(<Screen />);
    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());
    expect(screen.getByLabelText('Notasyon Verilerini Gizle')).not.toBeChecked();
  });

  it('Hamleler kartındaki onay kutusuna tıklayınca AYNI ANDA tahtanın etiketleri de kaybolur', async () => {
    render(<Screen />);
    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Notasyon Verilerini Gizle'));

    await waitFor(() => expect(screen.queryByText('8')).not.toBeInTheDocument());
    expect(screen.queryByText('a')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Notasyon Verilerini Gizle')).toBeChecked();
  });

  it('tekrar tıklayınca notasyon geri açılır', async () => {
    render(<Screen />);
    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());
    const checkbox = screen.getByLabelText('Notasyon Verilerini Gizle');
    fireEvent.click(checkbox);
    await waitFor(() => expect(screen.queryByText('8')).not.toBeInTheDocument());
    fireEvent.click(checkbox);
    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());
  });

  it('hamle verisi (notasyon) gizlemeden ETKİLENMEZ — arka planda kalır', async () => {
    render(<Screen />);
    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Notasyon Verilerini Gizle'));
    await waitFor(() => expect(screen.queryByText('8')).not.toBeInTheDocument());
    // Hamleler listesi (e4) hâlâ görünür — yalnız tahta koordinatları gizlendi.
    expect(screen.getByText('e4')).toBeInTheDocument();
  });

  it('tercih tarayıcıda kalıcıdır (localStorage) — yeni yüklemede aynı kalır', async () => {
    const first = render(<Screen />);
    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Notasyon Verilerini Gizle'));
    await waitFor(() => expect(localStorage.getItem('chess-hide-board-notation')).toBe('1'));
    first.unmount();

    // Yeni bir "sayfa yüklemesi" simülasyonu: taze mount, kayıtlı tercih okunmalı.
    render(<Screen />);
    await waitFor(() => expect(screen.queryByText('8')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Notasyon Verilerini Gizle')).toBeChecked();
  });
});
