import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { push, writePendingOpenPath } = vi.hoisted(() => ({
  push: vi.fn(),
  writePendingOpenPath: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '5', sectionId: '203' }),
  useRouter: () => ({ push }),
}));
vi.mock('@/lib/customTabsApi', () => ({ getCustomTab: vi.fn() }));
vi.mock('@/lib/customTabs/pendingOpenPath', () => ({ writePendingOpenPath }));
// Aynı gerekçe: tests/alt-konu-walkthrough.test.tsx'teki ChessBoard stub'u.
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-square="e4" data-fen={fen} />,
}));

import AltKonuPage from '@/app/(child)/custom/[id]/alt-konu/[sectionId]/page';
import { getCustomTab } from '@/lib/customTabsApi';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function mockDersHierarchy() {
  (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 5, label: 'Antrenör', emoji: '🎓',
    sections: [
      { id: 200, order_index: 1, title: 'Dersler', body: '', images: [], practice_positions: [], parent_id: null },
      { id: 201, order_index: 1, title: 'Temel Düzey', body: '', images: [], practice_positions: [], parent_id: 200 },
      { id: 202, order_index: 1, title: 'Tahta ve Taşlar', body: '', images: [], practice_positions: [], parent_id: 201 },
      {
        id: 203, order_index: 1, title: 'Tahtanın Genel Özellikleri', emoji: '📘',
        body: 'Konu açıklaması', images: [], parent_id: 202,
        practice_positions: [{ id: 'p1', fen: FEN }],
        explanation_cards: [{ id: 'c1', fen: FEN, sentence: 'Tahta 8x8 karelerden oluşur.' }],
      },
    ],
  });
}

describe('Alt Konu ayrı sayfası — görsel referans tasarımı (madde 2026-08-25)', () => {
  it('bölüm başlığı, yazı, Konum Havuzu sayacı ve açıklama kartları gösterilir', async () => {
    mockDersHierarchy();
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    expect(screen.getByText('Konu açıklaması')).toBeInTheDocument();
    expect(screen.getByText('1 / 1 — Konum Havuzu 001')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Açıklama 1'));
    expect(screen.getByText('Tahta 8x8 karelerden oluşur.')).toBeInTheDocument();
  });

  it('madde 2: başlığın solunda ikon/avatar YOKTUR', async () => {
    mockDersHierarchy();
    render(<AltKonuPage />);
    const heading = await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    expect(heading.textContent).toBe('Tahtanın Genel Özellikleri');
    expect(screen.queryByText('📘')).not.toBeInTheDocument();
  });

  it('bölüm bulunamazsa hata mesajı gösterir', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, label: 'Antrenör', emoji: '🎓', sections: [],
    });
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Bölüm bulunamadı'));
  });

  it('sekme bulunamazsa hata mesajı gösterir', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Sayfa bulunamadı'));
  });

  it('madde 3: Geri butonu Ana Menü\'ye döner ve Dersler→Düzey→Konu zincirini AÇIK bırakacak yolu kaydeder', async () => {
    push.mockClear();
    writePendingOpenPath.mockClear();
    mockDersHierarchy();
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));

    fireEvent.click(screen.getByLabelText('Geri'));
    // Alt Konu'nun (203) KENDİSİ hariç, kökten (Dersler=200) aşağı doğru zincir.
    expect(writePendingOpenPath).toHaveBeenCalledWith({ tabId: 5, path: [200, 201, 202] });
    expect(push).toHaveBeenCalledWith('/home');
  });
});
