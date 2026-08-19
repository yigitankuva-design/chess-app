import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { IncomingChallenge } from '@/lib/hooks/use-lobby';

const acceptChallenge = vi.fn();
const declineChallenge = vi.fn();
let incoming: IncomingChallenge | null = null;

vi.mock('@/lib/lobby/LobbyContext', () => ({
  useLobbyContext: () => ({
    players: [], offers: [], myOffer: null, notice: '', incoming,
    acceptChallenge, declineChallenge,
    challenge: vi.fn(), createOffer: vi.fn(), cancelOffer: vi.fn(), takeOffer: vi.fn(),
  }),
}));

import { ChallengeToast } from '@/components/play/ChallengeToast';

beforeEach(() => {
  acceptChallenge.mockReset();
  declineChallenge.mockReset();
  incoming = null;
});

describe('ChallengeToast (madde 2, 2026-08-20)', () => {
  it('teklif yokken hiç render edilmez', () => {
    const { container } = render(<ChallengeToast />);
    expect(container).toBeEmptyDOMElement();
  });

  it('teklif varken 3 satır görünür: Meydan Okuma / isim / tempo+süre', () => {
    incoming = { from_child_id: 5, from_name: 'Ayşe', criteria: { tempo: 'Hızlı', tc_label: '10+5' } };
    render(<ChallengeToast />);
    expect(screen.getByText('⚔️ Meydan Okuma')).toBeInTheDocument();
    expect(screen.getByText('Ayşe')).toBeInTheDocument();
    expect(screen.getByText('Hızlı · 10+5')).toBeInTheDocument();
  });

  it('yalnızca tc_label varsa (eski davetler) sadece o gösterilir', () => {
    incoming = { from_child_id: 5, from_name: 'Ayşe', criteria: { tc_label: '5+0' } };
    render(<ChallengeToast />);
    expect(screen.getByText('5+0')).toBeInTheDocument();
  });

  it('tempo/süre bilgisi yoksa UYDURULMAZ — satır hiç yok', () => {
    incoming = { from_child_id: 5, from_name: 'Ayşe', criteria: {} };
    render(<ChallengeToast />);
    expect(screen.getByText('Ayşe')).toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it('Evet acceptChallenge çağırır', () => {
    incoming = { from_child_id: 5, from_name: 'Ayşe', criteria: {} };
    render(<ChallengeToast />);
    fireEvent.click(screen.getByRole('button', { name: 'Evet' }));
    expect(acceptChallenge).toHaveBeenCalledTimes(1);
  });

  it('Hayır declineChallenge çağırır', () => {
    incoming = { from_child_id: 5, from_name: 'Ayşe', criteria: {} };
    render(<ChallengeToast />);
    fireEvent.click(screen.getByRole('button', { name: 'Hayır' }));
    expect(declineChallenge).toHaveBeenCalledTimes(1);
  });
});
