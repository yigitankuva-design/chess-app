import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'test-token' }));
vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({ reload: vi.fn() }),
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

  it('Maç Yap kartı açılınca 4 alt pencere başlığı görünür', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Maç Yap sekmesini aç'));
    expect(screen.getByText('Arkadaşınla Oyna')).toBeInTheDocument();
    expect(screen.getByText('Bota Karşı Oyna')).toBeInTheDocument();
    expect(screen.getByText('Açılış Pratiği Yap')).toBeInTheDocument();
    expect(screen.getByText('Turnuvaya Katıl')).toBeInTheDocument();
    // Alt pencereler KAPALI başlar: link henüz yok
    expect(screen.queryByText('Açılış Listesi')).not.toBeInTheDocument();
  });

  it('Açılış Pratiği Yap penceresi açılınca Açılış Listesi linki görünür', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Maç Yap sekmesini aç'));
    fireEvent.click(screen.getByText('Açılış Pratiği Yap'));
    const link = screen.getByText('Açılış Listesi').closest('a');
    expect(link).toHaveAttribute('href', '/admin/openings');
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
    fireEvent.click(screen.getByText('Açılış Pratiği Yap'));
    expect(screen.getByText('Açılış Listesi')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Turnuvaya Katıl'));
    expect(screen.queryByText('Açılış Listesi')).not.toBeInTheDocument();
  });

  it('Analiz Et kartı açılınca yakında notu görünür', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Analiz Et sekmesini aç'));
    expect(screen.getByText(/yakında/i)).toBeInTheDocument();
  });

  it('Eğlence kartı açılınca yakında notu görünür', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText('Eğlence sekmesini aç'));
    expect(screen.getByText(/yakında/i)).toBeInTheDocument();
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
    // Maç Yap artık 4 alt pencere gösterir (Açılış Listesi bir alt pencerenin içinde).
    expect(screen.getByText('Açılış Pratiği Yap')).toBeInTheDocument();
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
