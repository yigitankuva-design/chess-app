import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'test-token' }));
vi.mock('@/lib/settings/settings-context', async () => {
  const { DEFAULT_SETTINGS } = await import('@/lib/settings/defaults');
  return { useSettings: () => ({ settings: DEFAULT_SETTINGS, reload: vi.fn() }) };
});
vi.mock('@/lib/customTabsApi', () => ({
  listCustomTabs: vi.fn(),
  createCustomTab: vi.fn(),
  deleteCustomTab: vi.fn(() => Promise.resolve(true)),
  getCustomTab: vi.fn(),
  createCustomTabSection: vi.fn(),
  deleteCustomTabSection: vi.fn(() => Promise.resolve(true)),
  updateCustomTabSection: vi.fn(() => Promise.resolve(true)),
}));

import AdminTabsPage from '@/app/admin/settings/tabs/page';
import {
  listCustomTabs, getCustomTab, createCustomTabSection, updateCustomTabSection,
} from '@/lib/customTabsApi';

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks ÇAĞRILARI temizler ama mockResolvedValue ile kurulan
  // davranışı BIRAKIR — bu mock testler arasında sızıp sahte alt sekme
  // üretiyordu (aynı key uyarısı). Bunu her testte sıfırdan kuruyoruz.
  (createCustomTabSection as ReturnType<typeof vi.fn>).mockReset();
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: async () => ({}) }),
  ) as never;
  (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: 7, order_index: 1, label: 'Turnuvalar', emoji: '📌' },
  ]);
  (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 7, label: 'Turnuvalar', emoji: '📌',
    sections: [{ id: 10, order_index: 1, title: 'Kayıt Şartları', body: 'En az 8 yaş', images: [] }],
  });
});

async function openTurnuvalar() {
  render(<AdminTabsPage />);
  await waitFor(() => screen.getByText(/Turnuvalar/));
  fireEvent.click(screen.getByLabelText('Turnuvalar sekmesini aç'));
  await waitFor(() => screen.getByText('Kayıt Şartları'));
}

describe('Admin özel sekme — alt sekmeler kart içinde (inline)', () => {
  it('AÇ basınca alt sekme başlığı görünür, yazı henüz görünmez (kapalı akordiyon)', async () => {
    await openTurnuvalar();
    expect(screen.getByText('Kayıt Şartları')).toBeInTheDocument();
    expect(screen.queryByText('En az 8 yaş')).not.toBeInTheDocument();
  });

  it('alt sekme başlığına tıklayınca yazı görünür', async () => {
    await openTurnuvalar();
    fireEvent.click(screen.getByText('Kayıt Şartları'));
    expect(screen.getByText('En az 8 yaş')).toBeInTheDocument();
  });

  it('+ Alt Sekme Ekle formu ile yeni alt sekme eklenebilir', async () => {
    (createCustomTabSection as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 11, order_index: 2, title: 'Ödüller', body: 'Kupa', images: [],
    });
    await openTurnuvalar();
    fireEvent.change(screen.getByPlaceholderText('Alt sekme başlığı'), { target: { value: 'Ödüller' } });
    fireEvent.change(screen.getByPlaceholderText('Yazı'), { target: { value: 'Kupa' } });
    fireEvent.click(screen.getByText('Alt sekme ekle'));
    await waitFor(() => expect(createCustomTabSection).toHaveBeenCalledWith(7, 'Ödüller', 'Kupa', []));
    await waitFor(() => screen.getByText('Ödüller'));
  });

  it('etiketi "Pratik Yap" OLMAYAN sekmede "Açılış Pratiği Yap" görünmez', async () => {
    await openTurnuvalar();
    expect(screen.queryByText('Açılış Pratiği Yap')).not.toBeInTheDocument();
  });

  it('etiketi tam olarak "Pratik Yap" olan sekmede sabit "Açılış Pratiği Yap" kısayolu görünür', async () => {
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, order_index: 1, label: 'Pratik Yap', emoji: '🧩' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9, label: 'Pratik Yap', emoji: '🧩', sections: [],
    });
    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Açılış Pratiği Yap'));
    // Ayrı sayfa yerine yerinde açılan üç tür kartı.
    expect(screen.getByText('e4 ile Başlayanlar')).toBeInTheDocument();
    expect(screen.getByText('d4 ile Başlayanlar')).toBeInTheDocument();
    expect(screen.getByText('Diğerleri')).toBeInTheDocument();
  });
});

describe('Admin özel sekme — alt sekme düzenleme', () => {
  it('Düzenle basınca başlık/yazı düzenlenebilir kutucuklara döner', async () => {
    await openTurnuvalar();
    fireEvent.click(screen.getByLabelText('Kayıt Şartları alt sekmesini düzenle'));
    const titleInput = screen.getByDisplayValue('Kayıt Şartları');
    const bodyInput = screen.getByDisplayValue('En az 8 yaş');
    expect(titleInput).toBeInTheDocument();
    expect(bodyInput).toBeInTheDocument();
  });

  it('Kaydet basınca updateCustomTabSection çağrılır ve liste güncellenir', async () => {
    (updateCustomTabSection as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    await openTurnuvalar();
    fireEvent.click(screen.getByLabelText('Kayıt Şartları alt sekmesini düzenle'));
    fireEvent.change(screen.getByDisplayValue('Kayıt Şartları'), { target: { value: 'Katılım Şartları' } });
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => expect(updateCustomTabSection).toHaveBeenCalledWith(
      10, { title: 'Katılım Şartları', body: 'En az 8 yaş', images: [] },
    ));
    await waitFor(() => screen.getByText('Katılım Şartları'));
    expect(screen.queryByText('Kayıt Şartları')).not.toBeInTheDocument();
  });

  it('Vazgeç basınca düzenleme kapanır, değişiklik kaydedilmez', async () => {
    await openTurnuvalar();
    fireEvent.click(screen.getByLabelText('Kayıt Şartları alt sekmesini düzenle'));
    fireEvent.change(screen.getByDisplayValue('Kayıt Şartları'), { target: { value: 'Silinecek' } });
    fireEvent.click(screen.getByText('Vazgeç'));
    expect(screen.getByText('Kayıt Şartları')).toBeInTheDocument();
    expect(updateCustomTabSection).not.toHaveBeenCalled();
  });
});

describe('Admin özel sekme — Pratik Yap konum havuzu', () => {
  it('Pratik Yap alt sekmesinde Konumu Kaydet ile havuza konum eklenir', async () => {
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, order_index: 1, label: 'Pratik Yap', emoji: '🎯' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, label: 'Pratik Yap', emoji: '🎯',
      sections: [{ id: 10, order_index: 1, title: 'Süresiz Pratik', body: '', images: [], practice_positions: [] }],
    });
    (updateCustomTabSection as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Süresiz Pratik'));
    fireEvent.click(screen.getByText('Süresiz Pratik'));
    await waitFor(() => screen.getByText(/Konum Havuzu/));

    // Artık önce ekleme yöntemi seçiliyor (Konum Dizerek Ekle / FEN Ekle).
    fireEvent.click(screen.getByText('Konum Dizerek Ekle'));
    fireEvent.click(screen.getByText('Konumu Kaydet'));

    await waitFor(() => {
      expect(updateCustomTabSection).toHaveBeenCalledWith(
        10, expect.objectContaining({ practice_positions: expect.any(Array) }),
      );
    });
  });

  it('Pratik Yap OLMAYAN sekmede konum havuzu bölümü GÖRÜNMEZ', async () => {
    await openTurnuvalar();
    fireEvent.click(screen.getByText('Kayıt Şartları'));
    await waitFor(() => screen.getByText('En az 8 yaş'));
    expect(screen.queryByText(/Konum Havuzu/)).not.toBeInTheDocument();
  });
});

describe('Admin — Pratik Yap 3 sabit alt sekme', () => {
  it('eksik sabit alt sekmeler açılışta oluşturulur', async () => {
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, order_index: 1, label: 'Pratik Yap', emoji: '🧩' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9, label: 'Pratik Yap', emoji: '🧩', sections: [],
    });
    (createCustomTabSection as ReturnType<typeof vi.fn>).mockImplementation(
      (_tabId: number, title: string) => Promise.resolve({
        id: title.length, order_index: 1, title, body: '', images: [], practice_positions: [],
      }),
    );

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));

    await waitFor(() => {
      expect(createCustomTabSection).toHaveBeenCalledWith(9, 'Kazanç Konumunu Pratik Yap', '', []);
    });
    await waitFor(() => {
      expect(createCustomTabSection).toHaveBeenCalledWith(9, 'Oyunsonu Pratiği Yap', '', []);
    });
  });

  it('sabit sekmeler zaten varsa TEKRAR oluşturulmaz', async () => {
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, order_index: 1, label: 'Pratik Yap', emoji: '🧩' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9, label: 'Pratik Yap', emoji: '🧩',
      sections: [
        { id: 1, order_index: 1, title: 'Kazanç Konumunu Pratik Yap', body: '', images: [], practice_positions: [] },
        { id: 2, order_index: 2, title: 'Oyunsonu Pratiği Yap', body: '', images: [], practice_positions: [] },
      ],
    });

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Kazanç Konumunu Pratik Yap'));
    expect(createCustomTabSection).not.toHaveBeenCalled();
  });

  it('sabit sekmelerde Düzenle/Sil YOK, hocanınkinde VAR', async () => {
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, order_index: 1, label: 'Pratik Yap', emoji: '🧩' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9, label: 'Pratik Yap', emoji: '🧩',
      sections: [
        { id: 1, order_index: 1, title: 'Kazanç Konumunu Pratik Yap', body: '', images: [], practice_positions: [] },
        { id: 2, order_index: 2, title: 'Oyunsonu Pratiği Yap', body: '', images: [], practice_positions: [] },
        { id: 3, order_index: 3, title: 'Hocanın Sekmesi', body: '', images: [], practice_positions: [] },
      ],
    });

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Hocanın Sekmesi'));

    expect(screen.queryByLabelText('Kazanç Konumunu Pratik Yap alt sekmesini sil')).toBeNull();
    expect(screen.queryByLabelText('Kazanç Konumunu Pratik Yap alt sekmesini düzenle')).toBeNull();
    expect(screen.getByLabelText('Hocanın Sekmesi alt sekmesini sil')).toBeInTheDocument();
    expect(screen.getByLabelText('Hocanın Sekmesi alt sekmesini düzenle')).toBeInTheDocument();
  });
});
