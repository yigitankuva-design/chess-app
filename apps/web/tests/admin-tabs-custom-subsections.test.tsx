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
  duplicateCustomTabSection: vi.fn(),
  // Madde 2026-09-02: Pratik Yap'ın Yukarı/Aşağı sıralaması + "Açılış Pratiği
  // Yap" artık eksikken en başa taşınıyor — ikisi de bu ucu çağırır.
  reorderCustomTabSections: vi.fn(() => Promise.resolve(true)),
}));

import AdminTabsPage from '@/app/admin/settings/tabs/page';
import {
  listCustomTabs, getCustomTab, createCustomTabSection, updateCustomTabSection,
  duplicateCustomTabSection, reorderCustomTabSections, deleteCustomTabSection,
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

  it('bir alt sekme açılınca İÇİNDE de kendi "+ Alt Sekme Ekle" formu görünür (madde: 2026-08-22, iç içe alt sekme)', async () => {
    (createCustomTabSection as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 12, order_index: 1, title: 'Yaş Grubu 8-10', body: '', images: [], parent_id: 10,
    });
    await openTurnuvalar();
    fireEvent.click(screen.getByText('Kayıt Şartları'));
    // "Kayıt Şartları" açık — kendi alt sekmesini eklemek için İKİNCİ bir form var.
    const formlar = screen.getAllByText('+ Alt Sekme Ekle');
    expect(formlar.length).toBeGreaterThanOrEqual(2);
    // Sıra: NESTED form (Kayıt Şartları'nın İÇİNDE) DOM'da KÖK formdan ÖNCE
    // gelir — çünkü açık bölümün içeriği, harita bitip kök form eklenmeden
    // ÖNCE çizilir. Bu yüzden [0] iç içe olanı seçer.
    const baslikKutulari = screen.getAllByPlaceholderText('Alt sekme başlığı');
    fireEvent.change(baslikKutulari[0], { target: { value: 'Yaş Grubu 8-10' } });
    fireEvent.click(screen.getAllByText('Alt sekme ekle')[0]);
    await waitFor(() => expect(createCustomTabSection).toHaveBeenCalledWith(7, 'Yaş Grubu 8-10', '', [], undefined, 10));
    await waitFor(() => screen.getByText('Yaş Grubu 8-10'));
  });

  it('iç içe eklenen alt sekmenin de kendi alt sekmesi olabilir (2. seviye)', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 7, label: 'Turnuvalar', emoji: '📌',
      sections: [
        { id: 10, order_index: 1, title: 'Kayıt Şartları', body: 'En az 8 yaş', images: [], parent_id: null },
        { id: 12, order_index: 1, title: 'Yaş Grubu 8-10', body: '', images: [], parent_id: 10 },
      ],
    });
    (createCustomTabSection as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 13, order_index: 1, title: 'Erkekler', body: '', images: [], parent_id: 12,
    });
    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Turnuvalar/));
    fireEvent.click(screen.getByLabelText('Turnuvalar sekmesini aç'));
    await waitFor(() => screen.getByText('Kayıt Şartları'));
    fireEvent.click(screen.getByText('Kayıt Şartları'));
    await waitFor(() => screen.getByText('Yaş Grubu 8-10'));
    fireEvent.click(screen.getByText('Yaş Grubu 8-10'));
    // En derin (Yaş Grubu 8-10'un KENDİ) formu DOM'da İLK sırada — [0].
    const baslikKutulari = await waitFor(() => screen.getAllByPlaceholderText('Alt sekme başlığı'));
    fireEvent.change(baslikKutulari[0], { target: { value: 'Erkekler' } });
    fireEvent.click(screen.getAllByText('Alt sekme ekle')[0]);
    await waitFor(() => expect(createCustomTabSection).toHaveBeenCalledWith(7, 'Erkekler', '', [], undefined, 12));
    await waitFor(() => screen.getByText('Erkekler'));
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
    // Madde 2026-09-02: "Açılış Pratiği Yap" da artık diğer 2 sabit alt
    // sekme gibi gerçekten OLUŞTURULMASI gereken bir kayıt — mock boş dönerse
    // ekranda hiç görünmez.
    (createCustomTabSection as ReturnType<typeof vi.fn>).mockImplementation(
      (_tabId: number, title: string, _body: string, _images: string[], _emoji?: string, _parentId?: number, sectionKind?: string) => Promise.resolve({
        id: title.length, order_index: 1, title, body: '', images: [], practice_positions: [], section_kind: sectionKind ?? null,
      }),
    );
    global.fetch = vi.fn((url: string) => {
      if (String(url).endsWith('/openings')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 1, name: "e4'lü Açılışlar", openings: [] },
            { id: 2, name: "d4'lü Açılışlar", openings: [] },
            { id: 3, name: 'Diğer Açılışlar', openings: [] },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as never;
    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Açılış Pratiği Yap'));
    // Üç tür kartı "Açılış Pratiği Yap" tıklanmadan görünmez (kapalı akordiyon).
    expect(screen.queryByText("e4'lü Açılışlar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Açılış Pratiği İçeriği kartını aç'));
    // Ayrı sayfa yerine yerinde açılan, admin'in eklediği tür kartları.
    await waitFor(() => expect(screen.getByText("e4'lü Açılışlar")).toBeInTheDocument());
    expect(screen.getByText("d4'lü Açılışlar")).toBeInTheDocument();
    expect(screen.getByText('Diğer Açılışlar')).toBeInTheDocument();
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
      (_tabId: number, title: string, _body: string, _images: string[], _emoji?: string, _parentId?: number, sectionKind?: string) => Promise.resolve({
        id: title.length, order_index: 1, title, body: '', images: [], practice_positions: [], section_kind: sectionKind ?? null,
      }),
    );

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));

    await waitFor(() => {
      expect(createCustomTabSection).toHaveBeenCalledWith(9, 'Açılış Pratiği Yap', '', [], undefined, undefined, 'opening');
    });
    await waitFor(() => {
      expect(createCustomTabSection).toHaveBeenCalledWith(9, 'Kazanç Konumunu Pratik Yap', '', [], undefined, undefined, 'kazanc');
    });
    await waitFor(() => {
      expect(createCustomTabSection).toHaveBeenCalledWith(9, 'Oyunsonu Pratiği Yap', '', [], undefined, undefined, 'oyunsonu');
    });
  });

  it('sabit sekmeler zaten varsa TEKRAR oluşturulmaz', async () => {
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, order_index: 1, label: 'Pratik Yap', emoji: '🧩' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9, label: 'Pratik Yap', emoji: '🧩',
      sections: [
        { id: 0, order_index: 0, title: 'Açılış Pratiği Yap', section_kind: 'opening', body: '', images: [], practice_positions: [] },
        { id: 1, order_index: 1, title: 'Kazanç Konumunu Pratik Yap', section_kind: 'kazanc', body: '', images: [], practice_positions: [] },
        { id: 2, order_index: 2, title: 'Oyunsonu Pratiği Yap', section_kind: 'oyunsonu', body: '', images: [], practice_positions: [] },
      ],
    });

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Kazanç Konumunu Pratik Yap'));
    expect(createCustomTabSection).not.toHaveBeenCalled();
    expect(reorderCustomTabSections).not.toHaveBeenCalled();
  });

  it('madde 2026-09-02: sabit sekmelerde de artık Düzenle/Sil VAR (hocanınkiyle AYNI)', async () => {
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, order_index: 1, label: 'Pratik Yap', emoji: '🧩' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9, label: 'Pratik Yap', emoji: '🧩',
      sections: [
        { id: 0, order_index: 0, title: 'Açılış Pratiği Yap', section_kind: 'opening', body: '', images: [], practice_positions: [] },
        { id: 1, order_index: 1, title: 'Kazanç Konumunu Pratik Yap', section_kind: 'kazanc', body: '', images: [], practice_positions: [] },
        { id: 2, order_index: 2, title: 'Oyunsonu Pratiği Yap', section_kind: 'oyunsonu', body: '', images: [], practice_positions: [] },
        { id: 3, order_index: 3, title: 'Hocanın Sekmesi', body: '', images: [], practice_positions: [] },
      ],
    });

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Hocanın Sekmesi'));

    for (const title of ['Açılış Pratiği Yap', 'Kazanç Konumunu Pratik Yap', 'Oyunsonu Pratiği Yap', 'Hocanın Sekmesi']) {
      expect(screen.getByLabelText(`${title} alt sekmesini sil`)).toBeInTheDocument();
      expect(screen.getByLabelText(`${title} alt sekmesini düzenle`)).toBeInTheDocument();
    }
  });

  it('madde 2026-09-02: sabit sekme Sil\'e basılınca onay istenir; onaylanmazsa silinmez', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, order_index: 1, label: 'Pratik Yap', emoji: '🧩' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9, label: 'Pratik Yap', emoji: '🧩',
      sections: [
        { id: 0, order_index: 0, title: 'Açılış Pratiği Yap', section_kind: 'opening', body: '', images: [], practice_positions: [] },
        { id: 1, order_index: 1, title: 'Kazanç Konumunu Pratik Yap', section_kind: 'kazanc', body: '', images: [], practice_positions: [] },
        { id: 2, order_index: 2, title: 'Oyunsonu Pratiği Yap', section_kind: 'oyunsonu', body: '', images: [], practice_positions: [] },
      ],
    });

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Açılış Pratiği Yap'));

    fireEvent.click(screen.getByLabelText('Açılış Pratiği Yap alt sekmesini sil'));
    expect(window.confirm).toHaveBeenCalled();
    expect(deleteCustomTabSection).not.toHaveBeenCalled();
    expect(screen.getByText('Açılış Pratiği Yap')).toBeInTheDocument();
  });

  it('madde 2026-09-02: hocanın SIRADAN sekmesi Sil\'e basılınca onay İSTENMEZ (mevcut davranış korunur)', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, order_index: 1, label: 'Pratik Yap', emoji: '🧩' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9, label: 'Pratik Yap', emoji: '🧩',
      sections: [
        { id: 0, order_index: 0, title: 'Açılış Pratiği Yap', section_kind: 'opening', body: '', images: [], practice_positions: [] },
        { id: 1, order_index: 1, title: 'Kazanç Konumunu Pratik Yap', section_kind: 'kazanc', body: '', images: [], practice_positions: [] },
        { id: 2, order_index: 2, title: 'Oyunsonu Pratiği Yap', section_kind: 'oyunsonu', body: '', images: [], practice_positions: [] },
        { id: 3, order_index: 3, title: 'Hocanın Sekmesi', body: '', images: [], practice_positions: [] },
      ],
    });
    (deleteCustomTabSection as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Hocanın Sekmesi'));

    fireEvent.click(screen.getByLabelText('Hocanın Sekmesi alt sekmesini sil'));
    expect(window.confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(deleteCustomTabSection).toHaveBeenCalledWith(3));
  });

  it('madde 2026-09-02: 3 sabit alt sekme Yukarı/Aşağı ile sıralanabilir, hocanınki dahil', async () => {
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, order_index: 1, label: 'Pratik Yap', emoji: '🧩' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9, label: 'Pratik Yap', emoji: '🧩',
      sections: [
        { id: 0, order_index: 0, title: 'Açılış Pratiği Yap', section_kind: 'opening', body: '', images: [], practice_positions: [] },
        { id: 1, order_index: 1, title: 'Kazanç Konumunu Pratik Yap', section_kind: 'kazanc', body: '', images: [], practice_positions: [] },
        { id: 2, order_index: 2, title: 'Oyunsonu Pratiği Yap', section_kind: 'oyunsonu', body: '', images: [], practice_positions: [] },
      ],
    });

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Açılış Pratiği Yap'));

    // İlk satırın (Açılış) Yukarı'sı pasif, son satırın (Oyunsonu) Aşağı'sı pasif.
    expect(screen.getByLabelText('Açılış Pratiği Yap alt sekmesini yukarı taşı')).toBeDisabled();
    expect(screen.getByLabelText('Oyunsonu Pratiği Yap alt sekmesini aşağı taşı')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Açılış Pratiği Yap alt sekmesini aşağı taşı'));
    await waitFor(() => {
      expect(reorderCustomTabSections).toHaveBeenCalledWith(9, [1, 0, 2]);
    });
  });
});

describe('Admin özel sekme — alt sekme yapısını kopyala (madde: 2026-08-24, "Sınıf 1"→"Sınıf 2")', () => {
  it('Kopyala basınca ad giren form açılır, onaylayınca duplicateCustomTabSection çağrılır ve ağaç yenilenir', async () => {
    (duplicateCustomTabSection as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 20, order_index: 2, title: 'Sınıf 2', body: '', images: [], parent_id: null,
    });
    await openTurnuvalar();
    fireEvent.click(screen.getByLabelText('Kayıt Şartları yapısını kopyala'));
    fireEvent.change(screen.getByPlaceholderText('Yeni bölümün adı (örn. Sınıf 2)'), {
      target: { value: 'Sınıf 2' },
    });

    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 7, label: 'Turnuvalar', emoji: '📌',
      sections: [
        { id: 10, order_index: 1, title: 'Kayıt Şartları', body: 'En az 8 yaş', images: [] },
        { id: 20, order_index: 2, title: 'Sınıf 2', body: '', images: [] },
      ],
    });
    fireEvent.click(screen.getByText('Kopyala', { selector: 'button.bg-amber-400\\/15' }));

    await waitFor(() => expect(duplicateCustomTabSection).toHaveBeenCalledWith(10, 'Sınıf 2'));
    await waitFor(() => screen.getByText('Sınıf 2'));
  });

  it('yeni ad boşken Kopyala butonu devre dışıdır', async () => {
    await openTurnuvalar();
    fireEvent.click(screen.getByLabelText('Kayıt Şartları yapısını kopyala'));
    const confirmButton = screen.getByText('Kopyala', { selector: 'button.bg-amber-400\\/15' });
    expect(confirmButton).toBeDisabled();
    expect(duplicateCustomTabSection).not.toHaveBeenCalled();
  });

  it('Vazgeç basınca kopyalama formu kapanır, çağrı yapılmaz', async () => {
    await openTurnuvalar();
    fireEvent.click(screen.getByLabelText('Kayıt Şartları yapısını kopyala'));
    fireEvent.change(screen.getByPlaceholderText('Yeni bölümün adı (örn. Sınıf 2)'), {
      target: { value: 'Sınıf 2' },
    });
    fireEvent.click(screen.getByText('Vazgeç'));
    expect(screen.queryByPlaceholderText('Yeni bölümün adı (örn. Sınıf 2)')).not.toBeInTheDocument();
    expect(duplicateCustomTabSection).not.toHaveBeenCalled();
  });
});

describe('Admin özel sekme — "Dersler" özel modu (madde: 2026-08-24, Düzey→Konu→Alt Konu)', () => {
  function mockAntrenorWithDersler() {
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 5, order_index: 1, label: 'Antrenör', emoji: '🧑‍🏫' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, label: 'Antrenör', emoji: '🧑‍🏫',
      sections: [
        { id: 100, order_index: 1, title: 'Sınıflarım', body: '', images: [], parent_id: null },
        { id: 200, order_index: 2, title: 'Dersler', body: '', images: [], parent_id: null },
        { id: 201, order_index: 1, title: 'Temel Düzey', body: '', images: [], parent_id: 200 },
        { id: 202, order_index: 1, title: 'Tahta ve Taşlar', body: '', images: [], parent_id: 201 },
        {
          id: 203, order_index: 1, title: 'Tahtanın Genel Özellikleri', body: '', images: [],
          parent_id: 202, practice_positions: [],
        },
      ],
    });
  }

  async function openAntrenor() {
    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Antrenör/));
    fireEvent.click(screen.getByLabelText('Antrenör sekmesini aç'));
    await waitFor(() => screen.getByText('Sınıflarım'));
  }

  it('Dersler ve altındaki TÜM düğümlerde Kopyala yok; Sınıflarım\'da hâlâ var', async () => {
    mockAntrenorWithDersler();
    await openAntrenor();
    expect(screen.getByLabelText('Sınıflarım yapısını kopyala')).toBeInTheDocument();
    expect(screen.queryByLabelText('Dersler yapısını kopyala')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => screen.getByText('Temel Düzey'));
    expect(screen.queryByLabelText('Temel Düzey yapısını kopyala')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Temel Düzey'));
    await waitFor(() => screen.getByText('Tahta ve Taşlar'));
    expect(screen.queryByLabelText('Tahta ve Taşlar yapısını kopyala')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    expect(screen.queryByLabelText('Tahtanın Genel Özellikleri yapısını kopyala')).not.toBeInTheDocument();
  });

  it('Konu seviyesinde (Tahta ve Taşlar) hâlâ "+ Alt Sekme Ekle" var', async () => {
    mockAntrenorWithDersler();
    await openAntrenor();
    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => screen.getByText('Temel Düzey'));
    fireEvent.click(screen.getByText('Temel Düzey'));
    await waitFor(() => screen.getByText('Tahta ve Taşlar'));
    fireEvent.click(screen.getByText('Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    // "+ Alt Sekme Ekle" formu hâlâ görünür (Alt Konu eklemeye devam edebilmeli).
    expect(screen.getAllByText('+ Alt Sekme Ekle').length).toBeGreaterThan(0);
  });

  it('Alt Konu (Tahtanın Genel Özellikleri) açılınca "+ Alt Sekme Ekle" yerine Konum Havuzu (Buton Ekle) gösterilir', async () => {
    mockAntrenorWithDersler();
    await openAntrenor();
    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => screen.getByText('Temel Düzey'));
    fireEvent.click(screen.getByText('Temel Düzey'));
    await waitFor(() => screen.getByText('Tahta ve Taşlar'));
    fireEvent.click(screen.getByText('Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));

    await waitFor(() => screen.getByText('Konum Havuzu'));
    expect(screen.getByText('Buton Ekle')).toBeInTheDocument();
  });

  it('Alt Konu\'da Buton Ekle → cümle → Konumu Kaydet → Havuza Ekle ile doğru bölüme (id 203) konum grubu eklenir', async () => {
    mockAntrenorWithDersler();
    (updateCustomTabSection as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    await openAntrenor();
    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => screen.getByText('Temel Düzey'));
    fireEvent.click(screen.getByText('Temel Düzey'));
    await waitFor(() => screen.getByText('Tahta ve Taşlar'));
    fireEvent.click(screen.getByText('Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    await waitFor(() => screen.getByText('Buton Ekle'));

    fireEvent.click(screen.getByText('Buton Ekle'));
    fireEvent.change(screen.getByPlaceholderText('Bu konumla ilgili açıklama cümlesi'), {
      target: { value: 'Tahta 8x8 karelerden oluşur.' },
    });
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    fireEvent.click(screen.getByText(/Havuza Ekle/));

    await waitFor(() => {
      expect(updateCustomTabSection).toHaveBeenCalledWith(
        203, expect.objectContaining({ position_pool: expect.any(Array) }),
      );
    });
  });

  it('madde 2026-08-27 (6): Kareye Tıkla/Taşa Tıkla/Taşı Oynat soru ekleme alanı KALDIRILDI', async () => {
    mockAntrenorWithDersler();
    await openAntrenor();
    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => screen.getByText('Temel Düzey'));
    fireEvent.click(screen.getByText('Temel Düzey'));
    await waitFor(() => screen.getByText('Tahta ve Taşlar'));
    fireEvent.click(screen.getByText('Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));

    await waitFor(() => screen.getByText('Konum Havuzu'));
    expect(screen.queryByText('Kareye Tıkla / Taşa Tıkla / Taşı Oynat')).not.toBeInTheDocument();
  });

  it('Konu (Tahta ve Taşlar) seviyesinde Konum Havuzu YOK', async () => {
    mockAntrenorWithDersler();
    await openAntrenor();
    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => screen.getByText('Temel Düzey'));
    fireEvent.click(screen.getByText('Temel Düzey'));
    await waitFor(() => screen.getByText('Tahta ve Taşlar'));
    fireEvent.click(screen.getByText('Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    expect(screen.queryByText('Konum Havuzu')).not.toBeInTheDocument();
    expect(screen.queryByText('Buton Ekle')).not.toBeInTheDocument();
  });
});
