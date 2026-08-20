import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LobbyOffer } from '@/lib/play/offers';

const createOffer = vi.fn();
const cancelOffer = vi.fn();
const takeOffer = vi.fn();
let offers: LobbyOffer[] = [];
let myOffer: LobbyOffer | null = null;
let notice = '';

vi.mock('@/lib/lobby/LobbyContext', () => ({
  useLobbyContext: () => ({
    players: [], incoming: null, offers, myOffer, notice,
    createOffer, cancelOffer, takeOffer,
    challenge: vi.fn(), acceptChallenge: vi.fn(), declineChallenge: vi.fn(),
  }),
}));

import { OfferBoard } from '@/components/play/OfferBoard';

const AYSE: LobbyOffer = {
  child_id: 7, display_name: 'Ayşe', tempo: 'Yıldırım',
  tc_label: '5+0', tc_base: 300, tc_increment: 0, color: 'white',
};
const MEHMET: LobbyOffer = {
  child_id: 9, display_name: 'Mehmet', tempo: 'Hızlı',
  tc_label: '10+0', tc_base: 600, tc_increment: 0, color: 'random',
};

beforeEach(() => {
  createOffer.mockReset();
  cancelOffer.mockReset();
  takeOffer.mockReset();
  offers = [];
  myOffer = null;
  notice = '';
});

describe('OfferBoard', () => {
  it('pano boşken bilgilendirme metni gösterir', () => {
    render(<OfferBoard />);
    expect(screen.getByText(/Şu an açık teklif yok/)).toBeInTheDocument();
  });

  it('teklifleri ad ve özetiyle listeler', () => {
    offers = [AYSE, MEHMET];
    render(<OfferBoard />);
    expect(screen.getByText('Ayşe')).toBeInTheDocument();
    expect(screen.getByText('Mehmet')).toBeInTheDocument();
    expect(screen.getByText('⚡ Yıldırım · 5+0 · Sen: ⚫ Siyah')).toBeInTheDocument();
  });

  it('her teklif satırında bir OYNA düğmesi vardır', () => {
    offers = [AYSE, MEHMET];
    render(<OfferBoard />);
    expect(screen.getAllByRole('button', { name: /teklifini al/ })).toHaveLength(2);
  });

  it('OYNA doğru child_id ile takeOffer çağırır', () => {
    offers = [AYSE, MEHMET];
    render(<OfferBoard />);
    fireEvent.click(screen.getByLabelText('Mehmet teklifini al'));
    expect(takeOffer).toHaveBeenCalledWith(9);
  });

  it('Maç Teklif Et formu açılır ve createOffer doğru değerlerle çağrılır', () => {
    render(<OfferBoard />);
    fireEvent.click(screen.getByRole('button', { name: /Maç Teklif Et/ }));
    fireEvent.click(screen.getByRole('button', { name: '10+5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siyah' }));
    fireEvent.click(screen.getByRole('button', { name: /Teklifi Yayınla/ }));
    expect(createOffer).toHaveBeenCalledWith({
      tempo: 'Hızlı', tc_label: '10+5', tc_base: 600, tc_increment: 5, color: 'black', rated: true,
    });
  });

  it('madde 6 (2026-08-20): Puansız seçilince createOffer rated:false ile çağrılır', () => {
    render(<OfferBoard />);
    fireEvent.click(screen.getByRole('button', { name: /Maç Teklif Et/ }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Puansız' }));
    fireEvent.click(screen.getByRole('button', { name: /Teklifi Yayınla/ }));
    expect(createOffer).toHaveBeenCalledWith(expect.objectContaining({ rated: false }));
  });

  it('madde 6: Puanlı teklif "🏆 Puanlı" etiketiyle ve unvan/puanla listelenir', () => {
    offers = [{ ...AYSE, rated: true, rating: 555, title: 'BD-2' }];
    render(<OfferBoard />);
    expect(screen.getByText(/BD-2 - Ayşe \(555\)/)).toBeInTheDocument();
    expect(screen.getByText(/🏆 Puanlı/)).toBeInTheDocument();
  });

  it('süre seçilmeden Teklifi Yayınla basılamaz', () => {
    render(<OfferBoard />);
    fireEvent.click(screen.getByRole('button', { name: /Maç Teklif Et/ }));
    fireEvent.click(screen.getByRole('button', { name: /Teklifi Yayınla/ }));
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('kendi teklifi varken "Teklifin panoda" satırı ve iptal düğmesi çıkar', () => {
    myOffer = AYSE;
    render(<OfferBoard />);
    expect(screen.getByText('Teklifin panoda')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Teklifini İptal Et/ }));
    expect(cancelOffer).toHaveBeenCalledTimes(1);
  });

  it('kendi teklifi yokken "Teklifin panoda" satırı ÇIKMAZ', () => {
    render(<OfferBoard />);
    expect(screen.queryByText('Teklifin panoda')).not.toBeInTheDocument();
  });

  it('offer_gone uyarısı ekranda gösterilir', () => {
    notice = 'Bu teklif alındı. Başka bir teklif seç.';
    render(<OfferBoard />);
    expect(screen.getByText(/Bu teklif alındı/)).toBeInTheDocument();
  });
});

describe('OfferBoard — teklifler arasında yatay çizgi (madde 8)', () => {
  it('ikinci ve sonraki tekliflerin üstünde ayırıcı vardır, ilkinde yoktur', () => {
    offers = [AYSE, MEHMET];
    render(<OfferBoard />);
    const ilk = screen.getByText('Ayşe').closest('div')!.parentElement!.parentElement!;
    const ikinci = screen.getByText('Mehmet').closest('div')!.parentElement!.parentElement!;
    expect(ilk.style.borderTop).toBe('');
    expect(ikinci.style.borderTop).not.toBe('');
  });
});
