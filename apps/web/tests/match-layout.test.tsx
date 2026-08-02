import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchLayout } from '@/components/play/MatchLayout';
import type { PlayerInfo } from '@/components/play/MatchLayout';

const top: PlayerInfo = { avatarId: 'robot', name: 'Bot', ms: 60000, active: false };
const bottom: PlayerInfo = { avatarId: 'girl', name: 'Sen', ms: 60000, active: true };

function renderLayout(overrides: Partial<Parameters<typeof MatchLayout>[0]> = {}) {
  return render(
    <MatchLayout
      top={top}
      bottom={bottom}
      board={<div data-testid="board-slot" />}
      moveList={<div data-testid="movelist-slot" />}
      over={false}
      drawLabel="Beraberlik Teklif Et (3)"
      drawDisabled={false}
      onOfferDraw={vi.fn()}
      onResign={vi.fn()}
      {...overrides}
    />,
  );
}

describe('MatchLayout — tek DOM ağacı (çift render YOK)', () => {
  it('tahta ve hamle listesi yalnızca BİR KEZ render edilir', () => {
    renderLayout();
    expect(screen.getAllByTestId('board-slot')).toHaveLength(1);
    expect(screen.getAllByTestId('movelist-slot')).toHaveLength(1);
  });

  it('Terk Et butonu yalnızca BİR KEZ vardır (mevcut testlerin getByRole varsayımı)', () => {
    renderLayout();
    expect(screen.getAllByRole('button', { name: 'Terk Et' })).toHaveLength(1);
  });
});

describe('MatchLayout — Yeniden Oyna butonu', () => {
  it('onRematch verilmezse buton HİÇ render edilmez', () => {
    renderLayout();
    expect(screen.queryByRole('button', { name: 'Yeniden Oyna' })).not.toBeInTheDocument();
  });

  it('onRematch verilirse buton görünür; rematchEnabled=false ise devre dışıdır', () => {
    renderLayout({ onRematch: vi.fn(), rematchEnabled: false });
    expect(screen.getByRole('button', { name: 'Yeniden Oyna' })).toBeDisabled();
  });

  it('rematchEnabled=true ise aktiftir', () => {
    renderLayout({ onRematch: vi.fn(), rematchEnabled: true });
    expect(screen.getByRole('button', { name: 'Yeniden Oyna' })).not.toBeDisabled();
  });
});

describe('MatchLayout — maç bitince sonuç gösterilir', () => {
  it('over=true ise resultSlot görünür', () => {
    renderLayout({ over: true, resultSlot: <p>Kazandın!</p> });
    expect(screen.getByText('Kazandın!')).toBeInTheDocument();
  });

  it('over=true ise Terk Et/Beraberlik butonları DEVRE DIŞI kalır (kaldırılmaz)', () => {
    renderLayout({ over: true, resultSlot: <p>Bitti</p> });
    expect(screen.getByRole('button', { name: 'Terk Et' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Beraberlik/ })).toBeDisabled();
  });
});

describe('MatchLayout — avatar ve isim gösterimi', () => {
  it('top ve bottom oyuncu isimleri görünür', () => {
    renderLayout();
    expect(screen.getByText('Bot')).toBeInTheDocument();
    expect(screen.getByText('Sen')).toBeInTheDocument();
  });
});
