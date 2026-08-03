import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ mode: 'suresiz' }),
  useSearchParams: () => new URLSearchParams('konu=Test&step=165&ders=42'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/practice/practiceApi', () => ({
  fetchLessonScores: vi.fn().mockResolvedValue(null),
  submitPracticeResult: vi.fn().mockResolvedValue({ score: 100, best_score: 100, improved: true }),
}));

import PratikPage from '@/app/(child)/pratik/[mode]/page';

function ex(code: string) {
  return {
    type: 'sentence_question' as const, instruction: 'S?', answer_kind: 'sentence' as const,
    options: ['Y', 'D'], correct_index: 1, code,
  };
}
const POOL = Array.from({ length: 5 }, (_, i) => ex(String(i + 1).padStart(3, '0')));

beforeEach(() => { sessionStorage.clear(); });

describe('pratik/[mode]/page — alt konu bazlı soru sayısı (madde 3)', () => {
  it('question_counts belirlenmişse havuzdan o kadar soru seçilir', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        steps: [{
          id: 165, type: 'explanation',
          content_json: { board_exercises: POOL, question_counts: { board_exercises: 2 } },
        }],
      }),
    }));
    render(<PratikPage />);
    await waitFor(() => screen.getByText(/5 soruluk havuzdan/));
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('question_counts belirlenmemişse eskisi gibi 20 sınırı geçerli (5 soruluk havuzda hepsi gösterilir)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        steps: [{ id: 165, type: 'explanation', content_json: { board_exercises: POOL } }],
      }),
    }));
    render(<PratikPage />);
    await screen.findByText('D');
    expect(screen.queryByText(/soruluk havuzdan/)).not.toBeInTheDocument();
  });
});
