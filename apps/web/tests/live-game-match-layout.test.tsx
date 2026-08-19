import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

let handler: ((d: unknown) => void) | null = null;

vi.mock('@/lib/hooks/use-websocket', () => ({
  useWebSocket: (_url: string | null, onMessage: (d: unknown) => void) => {
    handler = onMessage;
    return { send: vi.fn(), readyState: 1 };
  },
  wsBase: () => 'ws://test',
}));
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { LiveGame } from '@/components/LiveGame';

describe('LiveGame — game_info avatar bilgisi PracticeMatchLayout\'a gider', () => {
  it('white_avatar/black_avatar geldiğinde doğru emoji gösterilir', () => {
    render(<LiveGame gameId={1} myColor="white" />);
    act(() => handler!({
      type: 'game_info', white_name: 'Zafer', black_name: 'Hasan',
      white_avatar: 'knight', black_avatar: 'robot',
      white_to_move: true, moves: [], current_fen:
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      status: 'active',
    }));
    expect(screen.getByText('🤴')).toBeInTheDocument(); // knight
    expect(screen.getByText('🤖')).toBeInTheDocument(); // robot
  });

  it('madde 3 (2026-08-20): "Tekrar Oyna" kartı artık VAR (Açılış Pratiği tasarımına geçişle birlikte)', () => {
    render(<LiveGame gameId={1} myColor="white" />);
    expect(screen.getByRole('button', { name: 'Tekrar Oyna' })).toBeInTheDocument();
  });
});
