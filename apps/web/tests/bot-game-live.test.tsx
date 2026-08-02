import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/hooks/use-websocket', () => ({
  useWebSocket: () => ({ send: vi.fn(), readyState: 1 }),
  wsBase: () => 'ws://test',
}));
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok', getAthleteName: () => 'Sporcu' }));

import { BotGameLive } from '@/components/BotGameLive';

describe('BotGameLive — /games/bot/start doğru gövdeyle çağrılır', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renk/pozisyon/süre /games/bot/start gövdesine doğru geçer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ game_id: 42, fen: 'std', your_color: 'black' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<BotGameLive skillLevel={5} studentColor="b"
      startFen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
      timeControl={{ base: 300, increment: 2, label: '5+2' }} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body as string);
    expect(body).toEqual({
      skill_level: 5,
      student_color: 'b',
      start_fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      tc_base_seconds: 300,
      tc_increment_seconds: 2,
    });
  });

  it('dönen game_id ile LiveGame doğru myColor ile render edilir', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ game_id: 42, fen: 'std', your_color: 'black' }),
    }));

    render(<BotGameLive skillLevel={5} studentColor="b" />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Terk Et' })).toBeInTheDocument());
  });

  it('sayfa yenilemesinde AYNI oyuna bağlanır, YENİ /games/bot/start çağrılmaz', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ game_id: 42, fen: 'std', your_color: 'white' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = render(<BotGameLive skillLevel={5} studentColor="w" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    unmount();

    render(<BotGameLive skillLevel={5} studentColor="w" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Terk Et' })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1); // ikinci kez çağrılmadı
  });
});
