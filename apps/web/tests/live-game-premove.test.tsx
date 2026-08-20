import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';

const sent: object[] = [];
let handler: ((d: unknown) => void) | null = null;

vi.mock('@/lib/hooks/use-websocket', () => ({
  useWebSocket: (_url: string | null, onMessage: (d: unknown) => void) => {
    handler = onMessage;
    return { send: (d: object) => { sent.push(d); }, readyState: 1 };
  },
  wsBase: () => 'ws://test',
}));

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

/** Tahta stub'i: üst bileşenin verdiği ön-hamle geri çağrısını ve
 *  `interactive` prop DEĞERİNİ dışarı açar — asıl regresyon budur (madde 5,
 *  2026-08-21): `interactive` sıra rakipteyken de yanlışlıkla true kalıyordu,
 *  bu yüzden ChessBoard hiç ÖN-HAMLE dalına girmiyordu. */
let firePremove: ((from: string, to: string) => void) | null = null;
let lastInteractive: boolean | null = null;
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ interactive, onPremove }: {
    interactive?: boolean;
    onPremove?: (f: string, t: string) => void;
  }) => {
    lastInteractive = interactive ?? null;
    firePremove = onPremove ?? null;
    return <div data-testid="board" data-interactive={String(!!interactive)} />;
  },
}));

import { LiveGame } from '@/components/LiveGame';

/** Beyaz 1.e4 oynadı — sıra siyahta (rakipte), ben (myColor=white) sırada değilim. */
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
/** Siyah e5 oynadı — sıra tekrar bana (beyaza) geldi. */
const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

describe('LiveGame — ön-hamle (madde 5, regresyon: 2026-08-21)', () => {
  it('sıra RAKİPTEYKEN interactive=false olur (önceden hep true kalıp ön-hamle hiç ÇALIŞMIYORDU)', () => {
    render(<LiveGame gameId={1} myColor="white" />);
    act(() => handler!({ type: 'game_info', current_fen: AFTER_E4, white_to_move: false }));
    expect(lastInteractive).toBe(false);
  });

  it('sıra BANA geldiğinde interactive=true olur', () => {
    render(<LiveGame gameId={1} myColor="white" />);
    act(() => handler!({ type: 'game_info', current_fen: AFTER_E5, white_to_move: true }));
    expect(lastInteractive).toBe(true);
  });

  it('rakip sırasında verilen ön-hamle, sıra bana gelince kendiliğinden oynanır', () => {
    sent.length = 0;
    render(<LiveGame gameId={1} myColor="white" />);
    act(() => handler!({ type: 'game_info', current_fen: AFTER_E4, white_to_move: false }));

    // interactive=false iken de ChessBoard'a onPremove VERİLİR — ön-hamle
    // rakip sırasında seçilebilmeli.
    expect(firePremove).not.toBeNull();
    firePremove!('g1', 'f3');
    expect(sent.some((m) => (m as { type?: string }).type === 'move')).toBe(false);

    act(() => handler!({ type: 'move_made', san: 'e5', fen_after: AFTER_E5 }));
    expect(sent).toContainEqual({ type: 'move', uci: 'g1f3' });
  });
});
