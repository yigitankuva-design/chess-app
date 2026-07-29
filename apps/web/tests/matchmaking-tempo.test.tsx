import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const useWebSocket = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));
vi.mock('@/lib/hooks/use-websocket', () => ({
  useWebSocket: (url: string | null, cb: unknown) => useWebSocket(url, cb),
  wsBase: () => 'ws://test',
}));

import { MatchmakingScreen } from '@/components/MatchmakingScreen';

beforeEach(() => useWebSocket.mockClear());

describe('/play/online — kuyruğa temposuz girilemez', () => {
  it('önce tempo sorulur, soket HİÇ açılmaz', () => {
    render(<MatchmakingScreen onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: '5+0' })).toBeInTheDocument();
    expect(useWebSocket).not.toHaveBeenCalled();
  });

  it('düzey sorulmaz — insana karşı anlamsız', () => {
    render(<MatchmakingScreen onCancel={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Düzey 1' })).not.toBeInTheDocument();
  });

  it('tempo seçilince sokete tc_base ve tc_increment gider', () => {
    render(<MatchmakingScreen onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '5+3' }));
    fireEvent.click(screen.getByRole('button', { name: /Rakip Ara/ }));

    expect(useWebSocket).toHaveBeenCalledTimes(1);
    const url = useWebSocket.mock.calls[0][0] as string;
    expect(url).toContain('tc_base=300');
    expect(url).toContain('tc_increment=3');
    expect(screen.getByText(/Tempo: 5\+3/)).toBeInTheDocument();
  });
});
