import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { push, writePendingOpenPath, useBackOverride } = vi.hoisted(() => ({
  push: vi.fn(),
  writePendingOpenPath: vi.fn(),
  useBackOverride: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '5', sectionId: '203' }),
  useRouter: () => ({ push }),
}));
vi.mock('@/lib/customTabsApi', () => ({ getCustomTab: vi.fn() }));
// Madde 2026-09-07 (GRUP D): AltKonuWalkthrough artık useAuth() çağırıyor
// ("Ödev Gönder" ikonu role === 'teacher' iken görünür) — mockRole test
// başına değiştirilebilir, varsayılan null (çocuk).
let mockRole: 'teacher' | null = null;
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ login: vi.fn(), logout: vi.fn(), token: null, role: mockRole, userId: null }),
}));
vi.mock('@/lib/customTabs/pendingOpenPath', () => ({ writePendingOpenPath }));
// Madde 2026-09-04 (4): sayfa artık kendi "Geri" butonunu ÇİZMİYOR — özel
// geri mantığını useBackOverride'a kaydediyor (AppNav'ın TEK butonu okur).
// Bu testler o mantığı, gerçek butonu simüle ETMEDEN, kaydedilen fonksiyonu
// çağırarak doğrular.
vi.mock('@/lib/nav/backOverride', () => ({ useBackOverride }));
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
        practice_positions: [],
        // Madde 2026-09-11 (Ödev Sistemi Faz 2): müfredata bağlı → "Ödev Gönder" aktif.
        linked_lesson_step_id: 900,
        position_pool: [{
          id: 'g1', code: '001',
          steps: [{ id: 's1', fen: FEN, sentence: 'Tahta 8x8 karelerden oluşur.', turn: 'w' }],
        }],
      },
    ],
  });
}

beforeEach(() => { mockRole = null; });

describe('Alt Konu ayrı sayfası — görsel referans tasarımı (madde 2026-08-26)', () => {
  it('bölüm başlığı, yazı, Konum Havuzu sayacı ve aktif adımın cümlesi gösterilir', async () => {
    mockDersHierarchy();
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    expect(screen.getByText('Konu açıklaması')).toBeInTheDocument();
    // Madde 2026-09-09: sayaç artık AltKonuWalkthrough'tan onPoolLabelChange
    // callback'iyle bildirilip başlığın yanında gösteriliyor — bu bir ÇOCUK
    // BİLEŞENİN mount efekti sonrası gelen ayrı bir render turu, o yüzden
    // waitFor gerekir (bkz. AltKonuWalkthrough.tsx: Props.onPoolLabelChange).
    await waitFor(() => screen.getByText('1 / 1 — Konum Havuzu 001'));
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

  it('madde 3/2026-09-04 (4): kaydedilen geri mantığı Ana Menü\'ye döner ve Dersler→Düzey→Konu zincirini AÇIK bırakacak yolu kaydeder', async () => {
    push.mockClear();
    writePendingOpenPath.mockClear();
    useBackOverride.mockClear();
    mockDersHierarchy();
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));

    // Bölüm yüklendikten SONRAKİ son çağrı gerçek fonksiyonu taşır (yükleme
    // sırasında null ile de çağrılmış olabilir — bkz. "koşulsuz hook" notu).
    const lastCall = useBackOverride.mock.calls.at(-1)!;
    const goBack = lastCall[0] as () => void;
    expect(goBack).not.toBeNull();
    goBack();
    // Alt Konu'nun (203) KENDİSİ hariç, kökten (Dersler=200) aşağı doğru zincir.
    expect(writePendingOpenPath).toHaveBeenCalledWith({ tabId: 5, path: [200, 201, 202] });
    expect(push).toHaveBeenCalledWith('/home');
  });

  it('sayfa KENDİ görünür "Geri" butonunu çizmez (madde 2026-09-04 (4) — tek buton kuralı)', async () => {
    mockDersHierarchy();
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    expect(screen.queryByLabelText('Geri')).not.toBeInTheDocument();
  });

  it('madde 2026-09-07 (GRUP D): antrenör görünümünde "Ödev Gönder" ikonu bu bölümün id/başlığıyla görünür (müfredata bağlıysa)', async () => {
    mockRole = 'teacher';
    mockDersHierarchy();
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    expect(screen.getByLabelText('Ödev Gönder')).toBeInTheDocument();
  });

  it('madde 2026-09-11 (Ödev Sistemi Faz 2): müfredat bağı YOKKEN "Ödev Gönder" devre dışı', async () => {
    mockRole = 'teacher';
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, label: 'Antrenör', emoji: '🎓',
      sections: [
        { id: 200, order_index: 1, title: 'Dersler', body: '', images: [], practice_positions: [], parent_id: null },
        { id: 201, order_index: 1, title: 'Temel Düzey', body: '', images: [], practice_positions: [], parent_id: 200 },
        { id: 202, order_index: 1, title: 'Tahta ve Taşlar', body: '', images: [], practice_positions: [], parent_id: 201 },
        {
          id: 203, order_index: 1, title: 'Tahtanın Genel Özellikleri', body: '', images: [], parent_id: 202,
          practice_positions: [], linked_lesson_step_id: null,
          position_pool: [{ id: 'g1', code: '001', steps: [{ id: 's1', fen: FEN, sentence: 'x', turn: 'w' }] }],
        },
      ],
    });
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    expect(screen.queryByLabelText('Ödev Gönder')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ödev Gönder — bu alt konu müfredata bağlı değil')).toBeDisabled();
  });

  it('sporcu görünümünde "Ödev Gönder" ikonu GÖSTERİLMEZ', async () => {
    mockRole = null;
    mockDersHierarchy();
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    expect(screen.queryByLabelText('Ödev Gönder')).not.toBeInTheDocument();
  });
});
