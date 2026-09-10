import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Madde 2026-09-11 (Ödev Sistemi, Faz 1): "Ödevini Yap"ın BAŞARI PUANI
// kalktı — Süreli Pratik Yap artık "Ödevini Yap TAMAMLANDI mı" ile açılır.
// Backend lesson_scores'ta suresiz = 100 (tamamlandı) / 0 (yarım) vekili
// döndürür; kilit mantığı DEĞİŞMEDEN (bestScore>=eşik) çalışır.
vi.mock('next/navigation', () => ({
  useParams: () => ({ mode: 'sureli' }),
  useSearchParams: () => new URLSearchParams('konu=Test&step=165&ders=42'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const fetchLessonScores = vi.fn();
vi.mock('@/lib/practice/practiceApi', () => ({
  fetchLessonScores: (...args: unknown[]) => fetchLessonScores(...args),
  submitPracticeResult: vi.fn().mockResolvedValue({ score: 100, best_score: 100, improved: true }),
  submitOdevAnswer: vi.fn(),
  fetchOdevProgress: vi.fn().mockResolvedValue({ total: 1, answered_count: 0, correct_count: 0, completed: false, per_question_correct: [] }),
}));

import PratikPage from '@/app/(child)/pratik/[mode]/page';

const EX = {
  type: 'sentence_question' as const, instruction: 'S?', answer_kind: 'sentence' as const,
  options: ['Y', 'D'], correct_index: 1, code: '001',
};

function stubLesson() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      steps: [{
        id: 165, type: 'explanation',
        content_json: { title: 'Alt Konu', board_exercises_timed: [EX] },
      }],
    }),
  }));
}

beforeEach(() => {
  sessionStorage.clear();
  fetchLessonScores.mockReset();
});

describe('pratik/[mode]/page — "Ödevini Yap" tamamlanınca Süreli Pratik Yap açılır (madde 2026-09-11)', () => {
  it('Ödevini Yap TAMAMLANDIYSA (suresiz=100) Süreli AÇIK', async () => {
    fetchLessonScores.mockResolvedValue({ 165: { suresiz: 100 } });
    stubLesson();
    render(<PratikPage />);
    await screen.findByText('D');
    expect(screen.queryByText('Bu bölüm henüz kilitli')).not.toBeInTheDocument();
  });

  it('Ödevini Yap YARIM ise (suresiz=0) Süreli KİLİTLİ — mesaj "ödevini tamamla"', async () => {
    fetchLessonScores.mockResolvedValue({ 165: { suresiz: 0 } });
    stubLesson();
    render(<PratikPage />);
    await waitFor(() => screen.getByText('Bu bölüm henüz kilitli'));
    expect(screen.getByText(/Ödevini Yap.*ödevini tamamla/)).toBeInTheDocument();
    expect(screen.queryByText(/puan ve üzeri al/)).not.toBeInTheDocument();
  });

  it('Ödevini Yap hiç yapılmadıysa (kayıt yok) Süreli KİLİTLİ', async () => {
    fetchLessonScores.mockResolvedValue({});
    stubLesson();
    render(<PratikPage />);
    await waitFor(() => screen.getByText('Bu bölüm henüz kilitli'));
  });
});
