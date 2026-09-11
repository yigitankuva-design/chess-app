import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Madde 2026-09-11 (Görsel Turu Aşama D / Madde 7): "İnceleme" modu —
 * Sporcu Profili "Ödevlerim" panelindeki cevaplanmış bir karta tıklanınca
 * (`?review=<index>`) açılır. Belirtilen soruyu SABİT ilk-N settekinin
 * içinden gösterir, istenildiği kadar tekrar çözülebilir, ama HİÇBİR ŞEY
 * sunucuya YAZILMAZ — kartın rengi sadece ilk çözümle ilişkili kalır.
 */
let searchParamsString = 'konu=Alt%20Konu&step=165&ders=42&review=1';
const back = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ mode: 'suresiz' }),
  useSearchParams: () => new URLSearchParams(searchParamsString),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back }),
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
  back.mockReset();
  fetchLessonScores.mockReset();
  fetchLessonScores.mockResolvedValue({});
  submitPracticeResult.mockReset();
  submitOdevAnswer.mockReset();
  fetchOdevProgress.mockReset();
  searchParamsString = 'konu=Alt%20Konu&step=165&ders=42&review=1';
});

describe('pratik/[mode]/page — İnceleme modu (madde 2026-09-11, Aşama D)', () => {
  it('?review=1 ile 2. soruyu (S2) açar, "Soru İncelemesi" başlığı gösterir, hiçbir kayıt ucu çağrılmaz', async () => {
    stubLesson();
    render(<PratikPage />);

    await screen.findByText('S2?');
    expect(screen.getByText('Soru İncelemesi')).toBeInTheDocument();
    expect(screen.queryByText('S1?')).not.toBeInTheDocument();
    expect(screen.queryByText('Ödevini Yap')).not.toBeInTheDocument();
    expect(fetchOdevProgress).not.toHaveBeenCalled();
  });

  it('soru doğru cevaplanınca submitOdevAnswer ÇAĞRILMAZ (kayıt yok)', async () => {
    stubLesson();
    render(<PratikPage />);
    await screen.findByText('S2?');
    fireEvent.click(screen.getByText('Doğru')); // EX2'de doğru cevap

    await waitFor(() => expect(screen.getByText('Doğru')).toBeInTheDocument());
    expect(submitOdevAnswer).not.toHaveBeenCalled();
    expect(submitPracticeResult).not.toHaveBeenCalled();
  });

  it('yanlış cevaplanınca da submitOdevAnswer ÇAĞRILMAZ ve soru tekrar denenebilir (noRetry yok)', async () => {
    stubLesson();
    render(<PratikPage />);
    await screen.findByText('S2?');
    fireEvent.click(screen.getByText('Yanlış')); // EX2'de yanlış cevap

    await waitFor(() => expect(submitOdevAnswer).not.toHaveBeenCalled());
    // "Sonraki Soruya Geç" YOK (tek soru, noRetry kapalı) — tekrar deneme kendiliğinden açılır.
    expect(screen.queryByText('Sonraki Soruya Geç')).not.toBeInTheDocument();
  });

  it('"İncelemeyi Bitir" düğmesi router.back() çağırır', async () => {
    stubLesson();
    render(<PratikPage />);
    await screen.findByText('S2?');
    fireEvent.click(screen.getByText('İncelemeyi Bitir'));
    expect(back).toHaveBeenCalled();
  });

  it('review index havuz sınırının dışındaysa son soruya (index n-1) kısılır', async () => {
    searchParamsString = 'konu=Alt%20Konu&step=165&ders=42&review=99';
    stubLesson();
    render(<PratikPage />);
    await screen.findByText('S2?'); // n=2 → clamp edilen index 1 → EX2
  });

  it('?review yoksa normal "Ödevini Yap" akışı DEĞİŞMEDEN çalışır (regresyon)', async () => {
    searchParamsString = 'konu=Alt%20Konu&step=165&ders=42';
    fetchOdevProgress.mockResolvedValue({ total: 2, answered_count: 0, correct_count: 0, completed: false, per_question_correct: [] });
    stubLesson();
    render(<PratikPage />);
    await screen.findByText('S1?');
    expect(screen.queryByText('Soru İncelemesi')).not.toBeInTheDocument();
    expect(fetchOdevProgress).toHaveBeenCalledWith(165);
  });
});
