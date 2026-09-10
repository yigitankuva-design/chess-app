import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Madde 2026-09-11 (Ödev Sistemi, Faz 1): "Ödevini Yap" artık batch
// submitPracticeResult DEĞİL, soru soru submitOdevAnswer ile BİRİKİMLİ
// kaydeder. Bu testler o yeni akışı doğrular.
vi.mock('next/navigation', () => ({
  useParams: () => ({ mode: 'suresiz' }),
  useSearchParams: () => new URLSearchParams('konu=Test&step=165&ders=42'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const fetchLessonScores = vi.fn();
const submitPracticeResult = vi.fn();
const submitOdevAnswer = vi.fn();
const fetchOdevProgress = vi.fn();
vi.mock('@/lib/practice/practiceApi', () => ({
  fetchLessonScores: (...args: unknown[]) => fetchLessonScores(...args),
  submitPracticeResult: (...args: unknown[]) => submitPracticeResult(...args),
  submitOdevAnswer: (...args: unknown[]) => submitOdevAnswer(...args),
  fetchOdevProgress: (...args: unknown[]) => fetchOdevProgress(...args),
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
  submitOdevAnswer.mockReset();
  submitOdevAnswer.mockResolvedValue({ total: 2, answered_count: 2, correct_count: 1, completed: true, per_question_correct: [true, false] });
  fetchOdevProgress.mockReset();
  fetchOdevProgress.mockResolvedValue({ total: 2, answered_count: 0, correct_count: 0, completed: false, per_question_correct: [] });
});

describe('pratik/[mode]/page — "Ödevini Yap" birikimli cevap kaydı (madde 2026-09-11)', () => {
  it('1. soru doğru, 2. soru yanlış → submitOdevAnswer(step,0,true) ve (step,1,false)', async () => {
    stubLesson();
    render(<PratikPage />);

    await screen.findByText('S1?');
    fireEvent.click(screen.getByText('Doğru'));
    fireEvent.click(await screen.findByText('Sonraki Soruya Geç'));

    await screen.findByText('S2?');
    fireEvent.click(screen.getByText('Yanlış'));

    await waitFor(() => expect(submitOdevAnswer).toHaveBeenCalledWith(165, 0, true));
    await waitFor(() => expect(submitOdevAnswer).toHaveBeenCalledWith(165, 1, false));
    // Batch submitPracticeResult "suresiz"te ARTIK ÇAĞRILMAZ.
    expect(submitPracticeResult).not.toHaveBeenCalled();
  });

  it('ikisi de doğru → submitOdevAnswer(step,0,true) ve (step,1,true)', async () => {
    stubLesson();
    render(<PratikPage />);

    await screen.findByText('S1?');
    fireEvent.click(screen.getByText('Doğru'));
    fireEvent.click(await screen.findByText('Sonraki Soruya Geç'));

    await screen.findByText('S2?');
    fireEvent.click(screen.getByText('Doğru'));

    await waitFor(() => expect(submitOdevAnswer).toHaveBeenCalledWith(165, 0, true));
    await waitFor(() => expect(submitOdevAnswer).toHaveBeenCalledWith(165, 1, true));
  });
});
