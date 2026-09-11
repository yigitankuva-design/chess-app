import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

const fetchLessonScores = vi.fn();
const fetchPracticeDetail = vi.fn();
const fetchAttemptsSummary = vi.fn();
const fetchAttempts = vi.fn();
vi.mock('@/lib/practice/practiceApi', () => ({
  fetchLessonScores: (...args: unknown[]) => fetchLessonScores(...args),
  fetchPracticeDetail: (...args: unknown[]) => fetchPracticeDetail(...args),
  fetchAttemptsSummary: (...args: unknown[]) => fetchAttemptsSummary(...args),
  fetchAttempts: (...args: unknown[]) => fetchAttempts(...args),
}));

import { LessonProgressCard } from '@/components/profile/LessonProgressCard';

const MODULES = [
  { id: 1, name: 'Temel Düzey', lessons_count: 1 },
  { id: 2, name: 'Başlangıç Düzeyi', lessons_count: 0 },
  { id: 3, name: 'Orta Düzey', lessons_count: 0 },
  { id: 4, name: 'İleri Düzey', lessons_count: 0 },
];
const LESSONS_TD = [{ id: 10, order_index: 1, title: 'Tahta ve Taşlar' }];
const LESSON_DETAIL = {
  steps: [
    { id: 100, type: 'explanation', content_json: { title: 'Tahtanın Genel Özellikleri' } },
    { id: 101, type: 'explanation', content_json: { title: 'Merkez Kavramı' } },
  ],
};

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/modules/1/lessons')) return Promise.resolve({ ok: true, json: async () => LESSONS_TD });
    if (url.endsWith('/modules')) return Promise.resolve({ ok: true, json: async () => MODULES });
    if (url.includes('/lessons/10')) return Promise.resolve({ ok: true, json: async () => LESSON_DETAIL });
    return Promise.resolve({ ok: true, json: async () => [] });
  }) as unknown as typeof fetch);
}

beforeEach(() => {
  fetchLessonScores.mockReset();
  fetchLessonScores.mockResolvedValue({});
  fetchPracticeDetail.mockReset();
  fetchPracticeDetail.mockResolvedValue({
    best_score: 100, best_correct: 4, best_total: 5, attempts_count: 1,
    per_question_correct: [true, true, false, true, true], pool_size: 5,
    // Madde 2026-09-11 (Ödev Sistemi, Faz 1): "suresiz" tamamlanma bilgisi.
    completed: true, answered_count: 5,
  });
  fetchAttemptsSummary.mockReset();
  fetchAttemptsSummary.mockResolvedValue({
    daily: { total: 12, correct: 9, wrong: 3, success_rate: 75 },
    weekly: { total: 12, correct: 9, wrong: 3, success_rate: 75 },
    monthly: { total: 12, correct: 9, wrong: 3, success_rate: 75 },
    yearly: { total: 12, correct: 9, wrong: 3, success_rate: 75 },
  });
  fetchAttempts.mockReset();
  fetchAttempts.mockResolvedValue([
    { attempt_no: 1, correct_count: 4, total_count: 8, per_question_correct: [true, false, true, false, true, true, true, false] },
    { attempt_no: 2, correct_count: 8, total_count: 8, per_question_correct: Array(8).fill(true) },
  ]);
});

describe('LessonProgressCard — Sporcu Profili Ders İlerlemesi + Ödevlerim (madde 2026-09-05)', () => {
  it('TD sekmesi varsayılan seçili, Temel Düzey konuları listelenir', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    expect(screen.getByText(/Temel Düzey/)).toBeInTheDocument();
  });

  it('madde 2026-09-09: Konu kutucuğu artık sıra numarası yerine dersin adını gösterir', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    const button = await screen.findByLabelText('1. konu: Tahta ve Taşlar');
    expect(button.textContent).toBe('Tahta ve Taşlar');
  });

  it('bir Konu\'ya tıklayınca Alt Konuları açılır', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    // İkinci alt konu henüz kilitli (skor yok) — kilit ön ekiyle görünür.
    expect(screen.getByText(/Merkez Kavramı/)).toBeInTheDocument();
  });

  it('bir Alt Konu\'ya tıklayınca 3 mod sekmesi (Ödevini Yap/Süreli Pratik Yap/Kendini Test Et) görünür', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));

    expect(screen.getByText('Ödevini Yap')).toBeInTheDocument();
    expect(screen.getByText('Süreli Pratik Yap')).toBeInTheDocument();
    expect(screen.getByText('Kendini Test Et')).toBeInTheDocument();
  });

  it('"Ödevini Yap" seçilince ÖDEVLERİM paneli soru bazlı yeşil/kırmızı kareleri gösterir', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Ödevini Yap'));

    // Madde 2026-09-07 (GRUP B): 3. argüman opsiyonel childId — burada
    // undefined (kendi profilim modu, antrenör görünümü DEĞİL).
    await waitFor(() => expect(fetchPracticeDetail).toHaveBeenCalledWith(100, 'suresiz', undefined));
    await waitFor(() => screen.getByText('Ödevlerim'));
    // Madde 2026-09-09: "- {sıra}" eki kaldırıldı (başlık zaten kendi "- N"
    // ekini taşıyabiliyordu, "- 1 - 1" gibi bir tekrara yol açıyordu).
    expect(screen.getByText(/Tahtanın Genel Özellikleri konusuna ait/)).toBeInTheDocument();
  });

  it('madde 2026-09-09 (regresyon): alt konu başlığı kendi "- 1" ekini taşısa bile cümlede "- 1 - 1" tekrarı OLUŞMAZ', async () => {
    // Zafer'in bildirdiği gerçek senaryo: alt konu adı LESSON adıyla AYNI ve
    // zaten "- 1" ile bitiyor ("Tahtanın Genel Özellikleri - 1").
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/modules/1/lessons')) return Promise.resolve({ ok: true, json: async () => LESSONS_TD });
      if (url.endsWith('/modules')) return Promise.resolve({ ok: true, json: async () => MODULES });
      if (url.includes('/lessons/10')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            steps: [{ id: 100, type: 'explanation', content_json: { title: 'Tahtanın Genel Özellikleri - 1' } }],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    }) as unknown as typeof fetch);

    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri - 1'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri - 1'));
    fireEvent.click(screen.getByText('Ödevini Yap'));

    await waitFor(() => screen.getByText('Ödevlerim'));
    expect(screen.queryByText(/- 1 - 1/)).not.toBeInTheDocument();
    expect(screen.getByText(/Tahtanın Genel Özellikleri - 1 konusuna ait/)).toBeInTheDocument();
  });

  it('madde 2026-09-11 (Görsel Turu Aşama D / Madde 7): cevaplanmış (yeşil/kırmızı) kareler İnceleme moduna bağlantı verir, gri (cevaplanmamış) kare tıklanamaz', async () => {
    stubFetch();
    fetchPracticeDetail.mockResolvedValue({
      best_score: 0, best_correct: 2, best_total: 5, attempts_count: 1,
      per_question_correct: [true, false, null, true, null],
      pool_size: 5, completed: false, answered_count: 3,
    });
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Ödevini Yap'));
    await waitFor(() => screen.getByText('Ödevlerim'));

    // index 0 (doğru) ve 1 (yanlış) tıklanabilir bağlantı; index 2, 4 (gri) DEĞİL.
    const dogru = screen.getByLabelText('1. soruyu incele (doğru cevaplanmıştı)');
    const yanlis = screen.getByLabelText('2. soruyu incele (yanlış cevaplanmıştı)');
    expect(dogru.tagName).toBe('A');
    expect(dogru).toHaveAttribute('href', '/pratik/suresiz?konu=Tahtan%C4%B1n%20Genel%20%C3%96zellikleri&step=100&ders=10&review=0');
    expect(yanlis).toHaveAttribute('href', '/pratik/suresiz?konu=Tahtan%C4%B1n%20Genel%20%C3%96zellikleri&step=100&ders=10&review=1');
    expect(screen.queryByLabelText(/3\. soruyu incele/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/5\. soruyu incele/)).not.toBeInTheDocument();
    expect(screen.getByText('Bir soruya dokunarak inceleyebilirsin.')).toBeInTheDocument();
  });

  it('madde 2026-09-11 (Aşama D): antrenör (childId) görünümünde de aynı İnceleme bağlantıları görünür', async () => {
    stubFetch();
    fetchPracticeDetail.mockResolvedValue({
      best_score: 0, best_correct: 1, best_total: 5, attempts_count: 1,
      per_question_correct: [false, null, null, null, null],
      pool_size: 5, completed: false, answered_count: 1,
    });
    render(<LessonProgressCard childId={7} />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Ödevini Yap'));
    await waitFor(() => expect(fetchPracticeDetail).toHaveBeenCalledWith(100, 'suresiz', 7));

    expect(screen.getByLabelText('1. soruyu incele (yanlış cevaplanmıştı)')).toHaveAttribute(
      'href', '/pratik/suresiz?konu=Tahtan%C4%B1n%20Genel%20%C3%96zellikleri&step=100&ders=10&review=0',
    );
  });

  it('madde 2026-09-06 (Görsel 6): "Süreli Pratik Yap" seçilince Günlük/Haftalık/Aylık/Yıllık tablosu gösterilir', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Süreli Pratik Yap'));

    await waitFor(() => expect(fetchAttemptsSummary).toHaveBeenCalledWith(100, 'sureli', undefined));
    // Madde 2026-09-09: etiket artık sabit genişlikli AYRI bir alt-span
    // (hizalama için) — "Etiket:" ve değeri ayrı ayrı doğrulanıyor.
    expect(await screen.findByText('Günlük:')).toBeInTheDocument();
    expect(screen.getByText('Haftalık:')).toBeInTheDocument();
    expect(screen.getByText('Aylık:')).toBeInTheDocument();
    expect(screen.getByText('Yıllık:')).toBeInTheDocument();
    expect(screen.getByText('Günlük:').closest('div.grid')?.textContent).toContain('12');
    expect(screen.getAllByText('%75').length).toBe(4);
    expect(fetchPracticeDetail).not.toHaveBeenCalled();
  });

  it('madde 2026-09-06 (Görsel 7): "Kendini Test Et" seçilince Sınav-N sekmeleri ve soru bazlı kareler gösterilir', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Kendini Test Et'));

    await waitFor(() => expect(fetchAttempts).toHaveBeenCalledWith(100, 'test', undefined));
    expect(await screen.findByText('Sınav - 1')).toBeInTheDocument();
    expect(screen.getByText('Sınav - 2')).toBeInTheDocument();
    // Varsayılan seçili: Sınav-1 (4/8 doğru, eşik 85 → başarısız mesajı).
    expect(screen.getByText(/kritik eşiğin altındadır/)).toBeInTheDocument();

    // Sınav-2'ye geçilince (8/8, %100) başarı mesajı gösterilir.
    fireEvent.click(screen.getByText('Sınav - 2'));
    expect(screen.getByText(/başarı eşiğinin üzerinde/)).toBeInTheDocument();
  });

  it('madde 2026-09-06 (Görsel 5): "Ders İlerlemesi" başlığının kapsayıcısı alt çizgi taşır', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    const title = await screen.findByText('Ders İlerlemesi');
    const row = title.closest<HTMLElement>('div.flex.items-center.justify-between');
    expect(row?.className).toContain('border-b');
  });

  it('madde 2026-09-06 (Görsel 5): Konu kutucukları sabit 4\'lü ızgarada dizilir', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    const button = await screen.findByLabelText('1. konu: Tahta ve Taşlar');
    // button > .text-center (i) > grid (Konu ızgarası)
    const grid = button.parentElement?.parentElement;
    expect(grid?.style.gridTemplateColumns).toBe('repeat(4, 1fr)');
  });

  it('madde 2026-09-06 (Görsel 5): "Ödevini Yap" cümlesi ve kareler ortalanmış bir kapsayıcıda durur', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Ödevini Yap'));

    const sentence = await screen.findByText(/Tahtanın Genel Özellikleri konusuna ait/);
    expect(sentence.parentElement?.className).toContain('text-center');
  });

  it('madde 2026-09-06 (Görsel 5 - v2): seçili modun içeriği "Merkez Kavramı" kartından ÖNCE görünür (Ödevini Yap sekmesinin hemen altında)', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Ödevini Yap'));

    const odevlerim = await screen.findByText('Ödevlerim');
    // Alt Konu henüz kilitli olduğu için "🔒 Merkez Kavramı" olarak render
    // edilir (bkz. toggleSubtopic/locked mantığı) — tam eşleşme yerine regex.
    const merkezKavrami = screen.getByText(/Merkez Kavramı/);
    // merkezKavrami, odevlerim'den SONRA geliyorsa (FOLLOWING) demek ki
    // "Ödevlerim" içeriği doğru yerde — "Merkez Kavramı" kartının ÜSTÜNDE.
    expect(
      odevlerim.compareDocumentPosition(merkezKavrami) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('madde 2026-09-06 (Görsel 6 - v2): istatistik satırında "Doğru Sayısı"/"Yanlış Sayısı" yerine kısaltılmış "Doğru"/"Yanlış" kullanılır', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Süreli Pratik Yap'));

    await screen.findByText('Günlük:');
    expect(screen.getAllByText(/^Doğru:/).length).toBe(4);
    expect(screen.getAllByText(/^Yanlış:/).length).toBe(4);
    expect(screen.queryByText(/Doğru Sayısı/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Yanlış Sayısı/)).not.toBeInTheDocument();
  });

  it('madde 2026-09-06 (Görsel 6 - v2): istatistik satırının 4 sütunu her satırda AYNI grid tanımını kullanır (simetrik hizalama)', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Süreli Pratik Yap'));

    const gunluk = await screen.findByText('Günlük:');
    const yillik = screen.getByText('Yıllık:');
    const gunlukRow = gunluk.closest<HTMLElement>('div.grid');
    const yillikRow = yillik.closest<HTMLElement>('div.grid');
    expect(gunlukRow?.style.gridTemplateColumns).toBe(yillikRow?.style.gridTemplateColumns);
    expect(gunlukRow?.style.gridTemplateColumns).toBeTruthy();
  });

  it('madde 2026-09-09: "Günlük/Haftalık/Aylık/Yıllık" etiketleri sabit genişlikte, sayı her satırda aynı x konumundan başlar', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Süreli Pratik Yap'));

    const gunluk = await screen.findByText('Günlük:');
    const haftalik = screen.getByText('Haftalık:');
    expect(gunluk.style.width).toBe(haftalik.style.width);
    expect(gunluk.style.width).toBe('52px');
  });
});

describe('LessonProgressCard — zincir kilidi (madde 2026-09-11, Ödev Sistemi Faz 3: GRUP D kaldırıldı)', () => {
  it('önceki alt konu bitmeden sonraki Alt Konu KİLİTLİ kalır — ödev göndermek kilidi ezmez', async () => {
    fetchLessonScores.mockResolvedValue({});
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText(/🔒 Merkez Kavramı/));
    expect(screen.getByText(/🔒 Merkez Kavramı/)).toBeInTheDocument();
  });

  it('"Ödevini Yap" pill\'i özel bir renk (mavi) KULLANMAZ — mavi GRUP D ile kaldırıldı', async () => {
    fetchLessonScores.mockResolvedValue({ 100: { suresiz: 100, sureli: 100, test: 100 } });
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText(/Merkez Kavramı/));
    fireEvent.click(screen.getByText('Merkez Kavramı'));
    const odevPill = await screen.findByText('Ödevini Yap');
    expect(odevPill.style.background).not.toBe('#3b82f6');
  });
});
