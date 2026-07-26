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

import { IncomingChallengeBanner } from '@/components/play/IncomingChallengeBanner';

beforeEach(() => {
  acceptChallenge.mockReset();
  declineChallenge.mockReset();
  incoming = null;
});

describe('IncomingChallengeBanner', () => {
  it('teklif yokken hiç render edilmez', () => {
    const { container } = render(<IncomingChallengeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('teklif varken ad ve tempo görünür', () => {
    incoming = { from_child_id: 5, from_name: 'Ayşe', criteria: { tc_label: '5+0' } };
    render(<IncomingChallengeBanner />);
    expect(screen.getByText(/Ayşe sana maç teklif etti/)).toBeInTheDocument();
    expect(screen.getByText(/5\+0/)).toBeInTheDocument();
  });

  it('tempo bilgisi yoksa UYDURULMAZ', () => {
    incoming = { from_child_id: 5, from_name: 'Ayşe', criteria: {} };
    render(<IncomingChallengeBanner />);
    expect(screen.getByText(/Ayşe sana maç teklif etti/)).toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it('Evet acceptChallenge çağırır', () => {
    incoming = { from_child_id: 5, from_name: 'Ayşe', criteria: {} };
    render(<IncomingChallengeBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Evet' }));
    expect(acceptChallenge).toHaveBeenCalledTimes(1);
  });

  it('Hayır declineChallenge çağırır', () => {
    incoming = { from_child_id: 5, from_name: 'Ayşe', criteria: {} };
    render(<IncomingChallengeBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Hayır' }));
    expect(declineChallenge).toHaveBeenCalledTimes(1);
  });
});
