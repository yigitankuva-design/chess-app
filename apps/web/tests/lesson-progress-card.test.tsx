import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

const fetchLessonScores = vi.fn();
const fetchPracticeDetail = vi.fn();
vi.mock('@/lib/practice/practiceApi', () => ({
  fetchLessonScores: (...args: unknown[]) => fetchLessonScores(...args),
  fetchPracticeDetail: (...args: unknown[]) => fetchPracticeDetail(...args),
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

    await waitFor(() => expect(fetchPracticeDetail).toHaveBeenCalledWith(100, 'suresiz'));
    await waitFor(() => screen.getByText('Ödevlerim'));
    expect(screen.getByText(/Tahtanın Genel Özellikleri - 1 konusuna ait/)).toBeInTheDocument();
  });

  it('"Süreli Pratik Yap" veya "Kendini Test Et" seçilince "yakında" mesajı gösterir, gerçek veri çekmez', async () => {
    stubFetch();
    render(<LessonProgressCard />);
    await waitFor(() => screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    fireEvent.click(screen.getByLabelText('1. konu: Tahta ve Taşlar'));
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    fireEvent.click(screen.getByText('Süreli Pratik Yap'));

    await waitFor(() => screen.getByText(/yakında/));
    expect(fetchPracticeDetail).not.toHaveBeenCalled();
  });
});
