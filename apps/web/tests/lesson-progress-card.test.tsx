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

// Madde 2026-09-07 (GRUP D): Antrenör'ün Alt Konu bazlı ödev ataması.
const fetchMyActiveStepIds = vi.fn();
vi.mock('@/lib/assignmentsApi', () => ({
  fetchMyActiveStepIds: (...args: unknown[]) => fetchMyActiveStepIds(...args),
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
    best_score: 80, best_correct: 4, best_total: 5, attempts_count: 1,
    per_question_correct: [true, true, false, true, true], pool_size: 5,
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
  fetchMyActiveStepIds.mockReset();
  fetchMyActiveStepIds.mockResolvedValue(new Set());
});

describe('LessonProgressCard — Sporcu Profili Ders İlerlemesi + Ödevlerim (madde 2026-09-05)', () => {
  it('TD sekmesi varsayılan seçili, Temel Düzey konuları listelenir', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    expect(screen.getByText(/Temel Düzey/)).toBeInTheDocument();
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
    expect(screen.getByText(/Tahtanın Genel Özellikleri - 1 konusuna ait/)).toBeInTheDocument();
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
    expect(await screen.findByText('Günlük: 12')).toBeInTheDocument();
    expect(screen.getByText('Haftalık: 12')).toBeInTheDocument();
    expect(screen.getByText('Aylık: 12')).toBeInTheDocument();
    expect(screen.getByText('Yıllık: 12')).toBeInTheDocument();
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

    const sentence = await screen.findByText(/Tahtanın Genel Özellikleri - 1 konusuna ait/);
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

    await screen.findByText('Günlük: 12');
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

    const gunluk = await screen.findByText('Günlük: 12');
    const yillik = screen.getByText('Yıllık: 12');
    const gunlukRow = gunluk.closest<HTMLElement>('div.grid');
    const yillikRow = yillik.closest<HTMLElement>('div.grid');
    expect(gunlukRow?.style.gridTemplateColumns).toBe(yillikRow?.style.gridTemplateColumns);
    expect(gunlukRow?.style.gridTemplateColumns).toBeTruthy();
  });
});

describe('LessonProgressCard — "Ödev Gönder" ile Ödevini Yap aktivasyonu (madde 2026-09-07, GRUP D)', () => {
  it('normalde kilitli bir Alt Konu, ödev atanınca kilitsiz görünür ve tıklanabilir', async () => {
    // Varsayılan fetchLessonScores boş {} döner → "Merkez Kavramı" (101)
    // normalde kilitli (önceki alt konunun test skoru yok).
    fetchMyActiveStepIds.mockResolvedValue(new Set([101]));
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText(/Merkez Kavramı/));

    // 🔒 ön eki YOK — normal (kilitsiz) görünüm.
    expect(screen.getByText('Merkez Kavramı')).toBeInTheDocument();
    expect(screen.queryByText(/🔒 Merkez Kavramı/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Merkez Kavramı'));
    expect(await screen.findByText('Ödevini Yap')).toBeInTheDocument();
  });

  it('atanmış ve HENÜZ geçilmemiş Alt Konu\'da "Ödevini Yap" pill\'i mavi görünür', async () => {
    fetchMyActiveStepIds.mockResolvedValue(new Set([101]));
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText(/Merkez Kavramı/));
    fireEvent.click(screen.getByText('Merkez Kavramı'));

    const odevPill = await screen.findByText('Ödevini Yap');
    expect(odevPill).toHaveStyle({ background: '#3b82f6', color: '#fff' });
  });

  it('atanmış ama ZATEN GEÇİLMİŞ Alt Konu\'da pill mevcut "tamamlandı" (var(--t-accent)) rengini kullanır, mavi DEĞİL', async () => {
    fetchMyActiveStepIds.mockResolvedValue(new Set([101]));
    fetchLessonScores.mockResolvedValue({ 101: { suresiz: 90 } });
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText(/Merkez Kavramı/));
    fireEvent.click(screen.getByText('Merkez Kavramı'));

    const odevPill = await screen.findByText('Ödevini Yap');
    // NOT: toHaveStyle (getComputedStyle) jsdom'da "background: var(--x)"
    // shorthand'ını çözemiyor (bare var() longhand'a düşmüyor) — inline
    // style'ı DOĞRUDAN okuyoruz (element.style bunu ÇÖZMEDEN, yazıldığı
    // gibi geri verir — bkz. #3b82f6 testindeki toHaveStyle'ın çalıştığı
    // durumla farkı: o literal hex, bu bare var()).
    expect(odevPill.style.background).toBe('var(--t-accent)');
    expect(odevPill.style.background).not.toBe('#3b82f6');
  });

  it('ödev atanmamış bir Alt Konu normal kilit davranışını KORUR (regresyon)', async () => {
    fetchMyActiveStepIds.mockResolvedValue(new Set()); // hiçbir şey atanmadı
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText(/🔒 Merkez Kavramı/));
    expect(screen.getByText(/🔒 Merkez Kavramı/)).toBeInTheDocument();
  });
});
