import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'test-token' }));
vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({ reload: vi.fn() }),
}));
vi.mock('@/lib/customTabsApi', () => ({
  listCustomTabs: vi.fn(() => Promise.resolve([])),
  createCustomTab: vi.fn(() => Promise.resolve({ id: 1, order_index: 1, label: 'Turnuvalar', emoji: '📌' })),
  deleteCustomTab: vi.fn(() => Promise.resolve(true)),
}));

import AdminTabsPage from '@/app/admin/settings/tabs/page';

/** Sayfa açılışta /admin/settings çeker; boş gövde varsayılan ayarlara düşer. */
beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: async () => ({}) }),
  ) as never;
});

async function renderPage() {
  render(<AdminTabsPage />);
  await waitFor(() =>
    expect(screen.queryByText(/Yükleniyor/)).not.toBeInTheDocument(),
  );
}

describe('Admin Sekmeler — akordiyon', () => {
  it('dört sekme kartı da listelenir', async () => {
    await renderPage();
    expect(screen.getByText(/Maç Yap/)).toBeInTheDocument();
    expect(screen.getByText(/Dersler/)).toBeInTheDocument();
    expect(screen.getByText(/Analiz Et/)).toBeInTheDocument();
    expect(screen.getByText(/Eğlence/)).toBeInTheDocument();
  });

  it('her kartta dairesel AÇ düğmesi vardır', async () => {
    await renderPage();
    for (const label of ['Maç Yap', 'Dersler', 'Analiz Et', 'Eğlence']) {
      const btn = screen.getByLabelText(`${label} sekmesini aç`);
      expect(btn).toHaveTextContent('AÇ');
    }
  });

  it('kart kapalı başlar — Ders İçeriği linki görünmez', async () => {
    await renderPage();
    expect(screen.queryByText('Ders İçeriği')).not.toBeInTheDocument();
  });

  it('Dersler kartı açılınca Ders İçeriği linki görünür', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Dersler sekmesini aç'));
    const link = screen.getByText('Ders İçeriği').closest('a');
    expect(link).toHaveAttribute('href', '/admin/content');
  });

  it('Maç Yap kartı açılınca 3 alt pencere başlığı görünür', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Maç Yap sekmesini aç'));
    expect(screen.getByText('Arkadaşınla Oyna')).toBeInTheDocument();
    expect(screen.getByText('Bota Karşı Oyna')).toBeInTheDocument();
    expect(screen.getByText('Turnuvaya Katıl')).toBeInTheDocument();
    // "Açılış Pratiği Yap" artık burada değil — "Pratik Yap" özel sekmesine taşındı.
    expect(screen.queryByText('Açılış Pratiği Yap')).not.toBeInTheDocument();
  });

  it('Bota Karşı Oyna penceresi açılınca yakında notu görünür', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Maç Yap sekmesini aç'));
    fireEvent.click(screen.getByText('Bota Karşı Oyna'));
    expect(screen.getAllByText(/yakında/i).length).toBeGreaterThan(0);
  });

  it('alt pencereler TEK-AÇIK çalışır: biri açılınca öteki kapanır', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Maç Yap sekmesini aç'));
    fireEvent.click(screen.getByText('Bota Karşı Oyna'));
    expect(screen.getByText('Bota Karşı Oyna').closest('button')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByText('Turnuvaya Katıl'));
    expect(screen.getByText('Bota Karşı Oyna').closest('button')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Turnuvaya Katıl').closest('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('Analiz Et kartı açılınca yakında notu görünür', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Analiz Et sekmesini aç'));
    expect(screen.getByText(/yakında/i)).toBeInTheDocument();
  });

  it('Eğlence kartı açılınca oyun/yarışma ekleme alanı görünür (madde: 2026-08-21)', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Eğlence sekmesini aç'));
    expect(await screen.findByPlaceholderText(/Oyun\/yarışma adı/)).toBeInTheDocument();
    expect(screen.getByText('Henüz oyun/yarışma eklenmedi.')).toBeInTheDocument();
  });

  it('açık kartın düğmesi KAPAT olur ve aria-expanded true döner', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Dersler sekmesini aç'));
    const btn = screen.getByLabelText('Dersler sekmesini kapat');
    expect(btn).toHaveTextContent('KAPAT');
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('KAPAT tıklanınca içerik kapanır', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Dersler sekmesini aç'));
    fireEvent.click(screen.getByLabelText('Dersler sekmesini kapat'));
    expect(screen.queryByText('Ders İçeriği')).not.toBeInTheDocument();
  });

  it('AKORDİYON: ikinci kart açılınca ilki kapanır', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Dersler sekmesini aç'));
    fireEvent.click(screen.getByLabelText('Maç Yap sekmesini aç'));
    expect(screen.getByText('Arkadaşınla Oyna')).toBeInTheDocument();
    expect(screen.queryByText('Ders İçeriği')).not.toBeInTheDocument();
  });

  it('REGRESYON: kart kapalıyken sıralama ve Kaldır butonları çalışır', async () => {
    await renderPage();
    expect(screen.getAllByLabelText('Yukarı taşı')).toHaveLength(4);
    expect(screen.getAllByLabelText('Aşağı taşı')).toHaveLength(4);
    expect(screen.getAllByText('Kaldır')).toHaveLength(4);
    fireEvent.click(screen.getAllByText('Kaldır')[0]);
    // PATCH isteği gönderilir (ilk çağrı açılıştaki GET'ti)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });
});

describe('Admin Sekmeler — Yeni Sekme Ekle (B grubu)', () => {
  it('eski "Nereyi açsın?" seçici artık yok', async () => {
    await renderPage();
    expect(screen.queryByText('Nereyi açsın?')).not.toBeInTheDocument();
  });

  it('sadece ad girip Ekle ile yeni sekme oluşturulur', async () => {
    const { createCustomTab } = await import('@/lib/customTabsApi');
    await renderPage();
    fireEvent.change(screen.getByPlaceholderText('örn. Bulmacalar'), { target: { value: 'Turnuvalar' } });
    fireEvent.click(screen.getByText('Ekle'));
    await waitFor(() => expect(createCustomTab).toHaveBeenCalledWith('Turnuvalar', undefined));
  });

  it('eklenen sekme diğerleri gibi numaralı ve AÇ butonludur', async () => {
    const { listCustomTabs } = await import('@/lib/customTabsApi');
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 1, order_index: 1, label: 'Turnuvalar', emoji: '📌' },
    ]);
    await renderPage();
    await waitFor(() => screen.getByText(/Turnuvalar/));
    // İkon değiştirme özelliği (madde 3) sekme adını InlineTitleEdit ile sarar —
    // "5." ve "Turnuvalar" artık ayrı DOM düğümlerinde, bu yüzden tam metni
    // node.textContent üzerinden kontrol ediyoruz (varsayılan getByText yalnızca
    // bir düğümün DOĞRUDAN metin çocuklarına bakar, iç içe span'ları görmez).
    expect(screen.getByText((_, node) => node?.tagName === 'P' && /5\.\s*Turnuvalar/.test(node.textContent || ''))).toBeInTheDocument();
    expect(screen.getByLabelText('Turnuvalar sekmesini aç')).toHaveTextContent('AÇ');
  });
});
