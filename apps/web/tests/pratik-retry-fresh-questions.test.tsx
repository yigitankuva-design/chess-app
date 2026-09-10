import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Madde 2026-09-11 (Ödev Sistemi, Faz 1): "Ödevini Yap" İLK çözümde SABİT
// set (havuzun ilk N'i, admin sırası). Tamamlandıktan sonra "Tekrar Dene"
// → TEKRAR modu: sorular rastgele, cevaplar KAYDEDİLMEZ.
vi.mock('next/navigation', () => ({
  useParams: () => ({ mode: 'suresiz' }),
  useSearchParams: () => new URLSearchParams('konu=Test&step=200&ders=42'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
const submitOdevAnswer = vi.fn();
const fetchOdevProgress = vi.fn();
vi.mock('@/lib/practice/practiceApi', () => ({
  fetchLessonScores: vi.fn().mockResolvedValue(null),
  submitPracticeResult: vi.fn().mockResolvedValue({ score: 100, best_score: 100, improved: true }),
  submitOdevAnswer: (...a: unknown[]) => submitOdevAnswer(...a),
  fetchOdevProgress: (...a: unknown[]) => fetchOdevProgress(...a),
}));

import PratikPage from '@/app/(child)/pratik/[mode]/page';

function exercise(i: number) {
  return {
    type: 'sentence_question' as const,
    instruction: `Soru ${i}?`,
    answer_kind: 'sentence' as const,
    options: ['Y', 'D'],
    correct_index: 1,
    code: String(i).padStart(3, '0'),
  };
}
const POOL = Array.from({ length: 10 }, (_, i) => exercise(i + 1));

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  submitOdevAnswer.mockReset();
  submitOdevAnswer.mockResolvedValue({ total: 2, answered_count: 2, correct_count: 2, completed: true, per_question_correct: [true, true] });
  fetchOdevProgress.mockReset();
  // İlk çağrı (sayfa yüklenirken): ödev YARIM → ilk-çözüm modu.
  fetchOdevProgress.mockResolvedValueOnce({ total: 2, answered_count: 0, correct_count: 0, completed: false, per_question_correct: [] });
  // Sonraki çağrılar (handleFinish sonrası kontrol): ödev TAMAM.
  fetchOdevProgress.mockResolvedValue({ total: 2, answered_count: 2, correct_count: 2, completed: true, per_question_correct: [true, true] });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      steps: [{
        id: 200, type: 'explanation',
        content_json: { board_exercises: POOL, question_counts: { board_exercises: 2 } },
      }],
    }),
  }));
});

describe('pratik/[mode]/page — "Ödevini Yap": ilk çözüm sabit, tekrar rastgele (madde 2026-09-11)', () => {
  it('ilk çözüm havuzun İLK 2 sorusunu SIRAYLA gösterir', async () => {
    render(<PratikPage />);
    await screen.findByText('Soru 1?');   // ilk soru = havuz[0]
    fireEvent.click(screen.getByText('D'));
    fireEvent.click(await screen.findByText('Sonraki Soruya Geç'));
    await screen.findByText('Soru 2?');   // ikinci soru = havuz[1]
    fireEvent.click(screen.getByText('D'));

    await waitFor(() => screen.getByText('Tebrikler! Ödevini Tamamladın'));
  });

  it('tamamlanınca "Tekrar Dene" → tekrar modu (soru ekranına döner, kayıt YOK)', async () => {
    render(<PratikPage />);
    await screen.findByText('Soru 1?');
    fireEvent.click(screen.getByText('D'));
    fireEvent.click(await screen.findByText('Sonraki Soruya Geç'));
    await screen.findByText('Soru 2?');
    fireEvent.click(screen.getByText('D'));

    await waitFor(() => screen.getByText('Tekrar Dene'));
    submitOdevAnswer.mockClear();
    fireEvent.click(screen.getByText('Tekrar Dene'));

    // Yeni soru ekranı geldi.
    await waitFor(() => expect(POOL.some((_, i) => screen.queryByText(`Soru ${i + 1}?`))).toBe(true));
    // Tekrar çözümde cevap SUNUCUYA GÖNDERİLMEZ.
    fireEvent.click(screen.getAllByText('D')[0]);
    await new Promise((r) => setTimeout(r, 30));
    expect(submitOdevAnswer).not.toHaveBeenCalled();
  });
});
