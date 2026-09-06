import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ mode: 'suresiz' }),
  useSearchParams: () => new URLSearchParams('konu=Test&step=165&ders=42'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const fetchLessonScores = vi.fn();
const submitPracticeResult = vi.fn();
vi.mock('@/lib/practice/practiceApi', () => ({
  fetchLessonScores: (...args: unknown[]) => fetchLessonScores(...args),
  submitPracticeResult: (...args: unknown[]) => submitPracticeResult(...args),
}));

const logActivityTime = vi.fn();
vi.mock('@/lib/activity/activityApi', () => ({
  logActivityTime: (...args: unknown[]) => logActivityTime(...args),
}));

import PratikPage from '@/app/(child)/pratik/[mode]/page';

const EX1 = {
  type: 'sentence_question' as const, instruction: 'S1?', answer_kind: 'sentence' as const,
  options: ['Yanlış', 'Doğru'], correct_index: 1, code: '001',
};

function stubLesson() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      steps: [{
        id: 165, type: 'explanation',
        content_json: { title: 'Alt Konu', board_exercises: [EX1] },
      }],
    }),
  }));
}

beforeEach(() => {
  sessionStorage.clear();
  fetchLessonScores.mockReset();
  fetchLessonScores.mockResolvedValue({});
  submitPracticeResult.mockReset();
  submitPracticeResult.mockResolvedValue({ score: 100, best_score: 100, improved: true });
  logActivityTime.mockReset();
});

describe('pratik/[mode]/page — Sporcu Profili "Bu Hafta" Pratik Yap süresi (madde 2026-09-06)', () => {
  it('pratik bitince logActivityTime(\'practice\', süre) çağrılır', async () => {
    stubLesson();
    render(<PratikPage />);

    await screen.findByText('S1?');
    fireEvent.click(screen.getByText('Doğru'));

    await waitFor(() => expect(logActivityTime).toHaveBeenCalledWith('practice', expect.any(Number)));
  });
});
