import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Madde 2026-09-07 (bug fix): Zafer'in bildirdiği "Antrenör/Dersler'de bir
 * Alt Konu'ya girince 'Geri' ve 'Ana Sayfa' butonları tepki vermiyor"
 * hatası — GERÇEK BackOverrideProvider + AltKonuPage birlikte render
 * edilince "Maximum update depth exceeded" (sonsuz render döngüsü)
 * oluşuyordu (bkz. lib/nav/backOverride.tsx'teki düzeltme). Mevcut
 * tests/alt-konu-page.test.tsx bu hatayı YAKALAYAMAZ çünkü
 * `@/lib/nav/backOverride`'ı TAMAMEN mock'luyor (kasıtlı — o dosya
 * AltKonuPage'in KENDİ mantığını izole test ediyor). Bu dosya, o
 * ENTEGRASYON noktasını GERÇEK backOverride.tsx ile test eder.
 */
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
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-square="e4" data-fen={fen} />,
}));
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ login: vi.fn(), logout: vi.fn(), token: null, role: null, userId: null }),
}));

import AltKonuPage from '@/app/(child)/custom/[id]/alt-konu/[sectionId]/page';
import { getCustomTab } from '@/lib/customTabsApi';
import { BackOverrideProvider, useBackOverrideHandler } from '@/lib/nav/backOverride';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** AppNav'ın gerçekte yaptığını taklit eder: kayıtlı override'ı okuyup
 *  tek bir "Geri" butonuna bağlar — sayfa KENDİ butonunu çizmiyor. */
function AppNavStandIn() {
  const handler = useBackOverrideHandler();
  return <button type="button" onClick={() => handler?.()} aria-label="test-geri">Geri</button>;
}

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
        practice_positions: [],
        position_pool: [{ id: 'g1', code: '001', steps: [{ id: 's1', fen: FEN, sentence: 'Tahta 8x8 karelerden oluşur.', turn: 'w' }] }],
      },
    ],
  });
}

describe('AltKonuPage + gerçek BackOverrideProvider — sonsuz render döngüsü regresyonu (madde 2026-09-07)', () => {
  it('sonsuz render döngüsüne girmeden yüklenir ve AppNav\'ın TEK "Geri" butonu doğru çalışır', async () => {
    mockDersHierarchy();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      render(
        <BackOverrideProvider>
          <AppNavStandIn />
          <AltKonuPage />
        </BackOverrideProvider>,
      );
    });
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));

    // Sonsuz döngü olsaydı React tam olarak bu mesajı fırlatırdı.
    const loopErrors = errorSpy.mock.calls.filter((args) =>
      args.some((a) => typeof a === 'string' && a.includes('Maximum update depth exceeded')));
    expect(loopErrors).toHaveLength(0);
    errorSpy.mockRestore();

    fireEvent.click(screen.getByLabelText('test-geri'));
    // Alt Konu'nun (203) KENDİSİ hariç, kökten (Dersler=200) aşağı doğru zincir.
    expect(writePendingOpenPath).toHaveBeenCalledWith({ tabId: 5, path: [200, 201, 202] });
    expect(push).toHaveBeenCalledWith('/home');
  });
});
