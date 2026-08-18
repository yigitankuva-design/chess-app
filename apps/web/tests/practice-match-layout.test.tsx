import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PracticeMatchLayout } from '@/components/play/PracticeMatchLayout';
import type { PracticeAction } from '@/components/play/PracticeMatchLayout';
import type { PlayerInfo } from '@/components/play/MatchLayout';

const top: PlayerInfo = { avatarId: 'robot', name: 'Bot', ms: null, active: false };
const bottom: PlayerInfo = { avatarId: 'girl', name: 'Sen', ms: null, active: true };

function action(overrides: Partial<PracticeAction> = {}): PracticeAction {
  return { icon: '🔁', label: 'Aynı konumu tekrar pratik yap', onClick: vi.fn(), enabled: false, ...overrides };
}

function renderLayout(overrides: Partial<Parameters<typeof PracticeMatchLayout>[0]> = {}) {
  const actions: [PracticeAction, PracticeAction, PracticeAction, PracticeAction] = overrides.actions ?? [
    action({ icon: '🔁', label: 'Aynı konumu tekrar pratik yap' }),
    action({ icon: '🤝', label: 'Beraberlik teklif et', enabled: true }),
    action({ icon: '🏳️', label: 'Pratiği terk et', enabled: true }),
    action({ icon: '🎲', label: 'Farklı bir konumu pratik yap' }),
  ];
  return render(
    <PracticeMatchLayout
      top={top}
      bottom={bottom}
      board={<div data-testid="board-slot" />}
      moveList={<div data-testid="movelist-slot" />}
      outcome={null}
      {...overrides}
      actions={actions}
    />,
  );
}

describe('PracticeMatchLayout — 4 dairesel kart, yazı yok', () => {
  it('4 kart ikon\'la görünür, kart içinde metin YOKTUR (yalnız aria-label ile erişilir)', () => {
    renderLayout();
    const btn = screen.getByLabelText('Beraberlik teklif et');
    expect(btn).toHaveTextContent('🤝');
    expect(btn.className).toContain('pm-circle');
  });

  it('enabled=false olan kart disabled ve data-enabled=false taşır', () => {
    renderLayout();
    const btn = screen.getByLabelText('Aynı konumu tekrar pratik yap');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('data-enabled', 'false');
  });

  it('enabled=true olan kart tıklanabilir ve data-enabled=true taşır', () => {
    const onClick = vi.fn();
    renderLayout({
      actions: [
        action({ label: 'a' }),
        action({ label: 'b', enabled: true, onClick }),
        action({ label: 'c', enabled: true }),
        action({ label: 'd' }),
      ],
    });
    const btn = screen.getByLabelText('b');
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute('data-enabled', 'true');
    btn.click();
    expect(onClick).toHaveBeenCalled();
  });

  it('outcome=null iken geri bildirim kartı hiç render edilmez', () => {
    renderLayout({ outcome: null });
    expect(screen.queryByText('Tebrikler Kazandın')).not.toBeInTheDocument();
    expect(screen.queryByText('Berabere Bitti')).not.toBeInTheDocument();
    expect(screen.queryByText('Bot Kazandı')).not.toBeInTheDocument();
  });

  it('outcome=win → yeşil "Tebrikler Kazandın" kartı', () => {
    renderLayout({ outcome: 'win' });
    const el = screen.getByText('Tebrikler Kazandın');
    expect(el).toHaveClass('t-ok');
  });

  it('outcome=draw → mavi "Berabere Bitti" kartı', () => {
    renderLayout({ outcome: 'draw' });
    const el = screen.getByText('Berabere Bitti');
    expect(el).toHaveClass('t-info');
  });

  it('outcome=loss → kırmızı "Bot Kazandı" kartı', () => {
    renderLayout({ outcome: 'loss' });
    const el = screen.getByText('Bot Kazandı');
    expect(el).toHaveClass('t-err');
  });

  it('tahta ve hamle listesi görünür', () => {
    renderLayout();
    expect(screen.getByTestId('board-slot')).toBeInTheDocument();
    expect(screen.getByTestId('movelist-slot')).toBeInTheDocument();
  });
});
