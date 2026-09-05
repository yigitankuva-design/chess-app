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

import PratikPage from '@/app/(child)/pratik/[mode]/page';

const EX1 = {
  type: 'sentence_question' as const, instruction: 'S1?', answer_kind: 'sentence' as const,
  options: ['Yanlış', 'Doğru'], correct_index: 1, code: '001',
};
const EX2 = {
  type: 'sentence_question' as const, instruction: 'S2?', answer_kind: 'sentence' as const,
  options: ['Doğru', 'Yanlış'], correct_index: 0, code: '002',
};

function stubLesson() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      steps: [{
        id: 165, type: 'explanation',
        content_json: { title: 'Alt Konu', board_exercises: [EX1, EX2] },
      }],
    }),
  }));
}

beforeEach(() => {
  sessionStorage.clear();
  fetchLessonScores.mockReset();
  fetchLessonScores.mockResolvedValue({});
  submitPracticeResult.mockReset();
  submitPracticeResult.mockResolvedValue({ score: 50, best_score: 50, improved: true });
});

describe('pratik/[mode]/page — soru bazlı doğru/yanlış biriktirme (madde 2026-09-05: Sporcu Profili Ödevlerim)', () => {
  it('1. soru doğru, 2. soru yanlış cevaplanınca submitPracticeResult [true, false] alır', async () => {
    stubLesson();
    render(<PratikPage />);

    // 1. soru: doğru şıkkı seç ("Doğru").
    await screen.findByText('S1?');
    fireEvent.click(screen.getByText('Doğru'));
    fireEvent.click(await screen.findByText('Sonraki Soruya Geç'));

    // 2. soru: yanlış şıkkı seç ("Yanlış") — noRetry, oturum burada biter (son soru).
    await screen.findByText('S2?');
    fireEvent.click(screen.getByText('Yanlış'));

    await waitFor(() => expect(submitPracticeResult).toHaveBeenCalled());
    const call = submitPracticeResult.mock.calls[0];
    expect(call[0]).toBe(165);       // stepId
    expect(call[1]).toBe('suresiz'); // mode
    expect(call[2]).toBe(1);         // correct
    expect(call[3]).toBe(2);         // total
    expect(call[4]).toEqual([true, false]); // perQuestion
  });

  it('ikisi de doğru cevaplanınca [true, true] gönderilir', async () => {
    stubLesson();
    render(<PratikPage />);

    await screen.findByText('S1?');
    fireEvent.click(screen.getByText('Doğru'));
    fireEvent.click(await screen.findByText('Sonraki Soruya Geç'));

    await screen.findByText('S2?');
    fireEvent.click(screen.getByText('Doğru'));

    await waitFor(() => expect(submitPracticeResult).toHaveBeenCalled());
    const call = submitPracticeResult.mock.calls[0];
    expect(call[4]).toEqual([true, true]);
  });
});
