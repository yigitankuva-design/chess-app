import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ mode: 'sureli' }),
  useSearchParams: () => new URLSearchParams('konu=Test&step=165&ders=42'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const fetchLessonScores = vi.fn();
vi.mock('@/lib/practice/practiceApi', () => ({
  fetchLessonScores: (...args: unknown[]) => fetchLessonScores(...args),
  submitPracticeResult: vi.fn().mockResolvedValue({ score: 100, best_score: 100, improved: true }),
}));

import PratikPage from '@/app/(child)/pratik/[mode]/page';

const EX = {
  type: 'sentence_question' as const, instruction: 'S?', answer_kind: 'sentence' as const,
  options: ['Y', 'D'], correct_index: 1, code: '001',
};

function stubLesson(successScore?: number) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      steps: [{
        id: 165, type: 'explanation',
        content_json: {
          title: 'Alt Konu',
          board_exercises_timed: [EX],
          ...(successScore !== undefined ? { success_scores: { board_exercises: successScore } } : {}),
        },
      }],
    }),
  }));
}

beforeEach(() => {
  sessionStorage.clear();
  fetchLessonScores.mockReset();
});

describe('pratik/[mode]/page — hoca özel başarı puanı (Süresiz → Süreli kilidi)', () => {
  it('hoca 60 girdiyse, 65 puanla Süreli AÇIK olur (85 beklenmez)', async () => {
    fetchLessonScores.mockResolvedValue({ 165: { suresiz: 65 } });
    stubLesson(60);
    render(<PratikPage />);
    await screen.findByText('D');
    expect(screen.queryByText('Bu bölüm henüz kilitli')).not.toBeInTheDocument();
  });

  it('hoca 90 girdiyse, 65 puan YETMEZ — kilitli ekran gerçek eşiği (90) gösterir', async () => {
    fetchLessonScores.mockResolvedValue({ 165: { suresiz: 65 } });
    stubLesson(90);
    render(<PratikPage />);
    await waitFor(() => screen.getByText('Bu bölüm henüz kilitli'));
    expect(screen.getByText(/90 puan ve üzeri al/)).toBeInTheDocument();
  });

  it('özel puan girilmediyse eskisi gibi 85 kullanılır (80 yetmez)', async () => {
    fetchLessonScores.mockResolvedValue({ 165: { suresiz: 80 } });
    stubLesson(undefined);
    render(<PratikPage />);
    await waitFor(() => screen.getByText('Bu bölüm henüz kilitli'));
    expect(screen.getByText(/85 puan ve üzeri al/)).toBeInTheDocument();
  });

  it('özel puan girilmediyse ve skor 85+ ise eskisi gibi açık olur', async () => {
    fetchLessonScores.mockResolvedValue({ 165: { suresiz: 85 } });
    stubLesson(undefined);
    render(<PratikPage />);
    await screen.findByText('D');
    expect(screen.queryByText('Bu bölüm henüz kilitli')).not.toBeInTheDocument();
  });
});
