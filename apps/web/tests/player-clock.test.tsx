import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerClock } from '@/components/play/PlayerClock';

describe('PlayerClock', () => {
  it('ad ve saati gösterir', () => {
    render(<PlayerClock name="Ayşe" ms={300_000} active={false} />);
    expect(screen.getByText('Ayşe')).toBeInTheDocument();
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('sırası gelen vurgulanır', () => {
    render(<PlayerClock name="Ayşe" ms={300_000} active />);
    expect(screen.getByLabelText('Ayşe saati')).toHaveAttribute('data-active', 'true');
  });

  it('saat YOKSA sadece ad çizilir (tempsuz eski maç)', () => {
    render(<PlayerClock name="Ayşe" ms={null} active={false} />);
    expect(screen.getByText('Ayşe')).toBeInTheDocument();
    expect(screen.queryByText(/:/)).not.toBeInTheDocument();
  });

  it('düşük sürede uyarı işareti taşır', () => {
    render(<PlayerClock name="Ayşe" ms={5_000} active />);
    expect(screen.getByLabelText('Ayşe saati')).toHaveAttribute('data-low', 'true');
  });
});
