import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const pingPresence = vi.fn();
vi.mock('@/lib/presence/presenceApi', () => ({
  pingPresence: () => pingPresence(),
}));

import { PresenceProvider, usePresenceCount } from '@/lib/presence/PresenceContext';

function Probe() {
  const count = usePresenceCount();
  return <span data-testid="count">{count === null ? 'yok' : String(count)}</span>;
}

beforeEach(() => {
  pingPresence.mockReset();
  pingPresence.mockResolvedValue(3);
});

describe('PresenceProvider', () => {
  it('mount olunca HEMEN ping atar (30 sn beklemez)', async () => {
    render(<PresenceProvider><Probe /></PresenceProvider>);
    await waitFor(() => expect(pingPresence).toHaveBeenCalledTimes(1));
  });

  it('gelen sayıyı hook üzerinden dağıtır', async () => {
    render(<PresenceProvider><Probe /></PresenceProvider>);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('3'));
  });

  it('sayı 0 ise 0 gösterir (null ile karışmaz)', async () => {
    pingPresence.mockResolvedValue(0);
    render(<PresenceProvider><Probe /></PresenceProvider>);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
  });

  it('ping null dönerse sayı bilinmiyor kalır', async () => {
    pingPresence.mockResolvedValue(null);
    render(<PresenceProvider><Probe /></PresenceProvider>);
    await waitFor(() => expect(pingPresence).toHaveBeenCalled());
    expect(screen.getByTestId('count')).toHaveTextContent('yok');
  });

  it('aralık dolunca TEKRAR ping atar', async () => {
    render(
      <PresenceProvider intervalMs={40}><Probe /></PresenceProvider>,
    );
    // Kisa aralik + waitFor: sahte zamanlayici KULLANILMIYOR (bkz. plan basi).
    await waitFor(
      () => expect(pingPresence.mock.calls.length).toBeGreaterThanOrEqual(3),
      { timeout: 2000 },
    );
  });

  it('provider dışında kullanılırsa sayı bilinmiyor döner (çökmez)', () => {
    render(<Probe />);
    expect(screen.getByTestId('count')).toHaveTextContent('yok');
  });
});
