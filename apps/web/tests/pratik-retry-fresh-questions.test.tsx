import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ mode: 'suresiz' }),
  useSearchParams: () => new URLSearchParams('konu=Test&step=200&ders=42'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/practice/practiceApi', () => ({
  fetchLessonScores: vi.fn().mockResolvedValue(null),
  submitPracticeResult: vi.fn().mockResolvedValue({ score: 100, best_score: 100, improved: true }),
}));

import PratikPage from '@/app/(child)/pratik/[mode]/page';

/** 10 açılış sorulu geniş bir havuz — hepsi kolay (difficulty yok), her
 *  biri BENZERSİZ bir 'instruction' metniyle tanımlanır. Doğru cevap
 *  hepsinde 'D' (options: [yanlış, doğru]). */
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

/** Görünen soru metnini okur ('Soru N?' biçiminde). */
function currentQuestionText(): string {
  return (POOL.map((_, i) => `Soru ${i + 1}?`).find((t) => screen.queryByText(t)) ?? '');
}

/** İki soruluk seti baştan sona çözer (ikisi de doğru), sonuç ekranına ulaşır. */
async function solveBothQuestions() {
  await screen.findByText('D');
  fireEvent.click(screen.getByText('D')); // 1. soru doğru
  fireEvent.click(await screen.findByText('Sonraki Soruya Geç'));
  await waitFor(() => expect(screen.getByText('D')).toBeInTheDocument());
  fireEvent.click(screen.getByText('D')); // 2. (son) soru doğru — oturum biter
}

describe('pratik/[mode]/page — "Tekrar Dene" farklı sorular getirir (madde: 2026-08-21)', () => {
  it('"Tekrar Dene"ye basınca YENİ bir set gelir, bir önceki turun sorularıyla ÇAKIŞMAZ', async () => {
    render(<PratikPage />);
    await solveBothQuestions();

    const firstRound = new Set<string>();
    await waitFor(() => expect(screen.getByText('Tekrar Dene')).toBeInTheDocument());
    // İlk turda gösterilen 2 soruyu practiceHistory'den okuyoruz (DOM artık
    // sonuç ekranında, sorular görünmüyor) — bunun yerine localStorage'a
    // kaydedilen kodları kontrol ediyoruz.
    const savedFirst = JSON.parse(localStorage.getItem('bsa:gecmis:200:suresiz') ?? '[]') as string[];
    savedFirst.forEach((c) => firstRound.add(c));
    expect(firstRound.size).toBe(2);

    fireEvent.click(screen.getByText('Tekrar Dene'));

    // İkinci tur başladı — yeni soruların kodları previousCodes ile ÇAKIŞMAZ.
    await waitFor(() => {
      const savedSecond = JSON.parse(localStorage.getItem('bsa:gecmis:200:suresiz') ?? '[]') as string[];
      expect(savedSecond).toHaveLength(2);
      const overlap = savedSecond.filter((c) => firstRound.has(c));
      expect(overlap).toHaveLength(0);
    });

    // Ekranda da gerçekten yeni bir soru görünüyor (ilk turdakiyle aynı DEĞİL
    // olması ZORUNLU değil ama en azından soru ekranına dönülmüş olmalı).
    await waitFor(() => expect(currentQuestionText()).not.toBe(''));
  });
});
