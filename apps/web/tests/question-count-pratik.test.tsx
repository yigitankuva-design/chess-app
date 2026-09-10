import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Madde 2026-09-11 (Ödev Sistemi, Faz 1): "Ödevini Yap" seti SABİT — havuzun
// ilk N'i (N = question_counts.board_exercises, yoksa havuzun TAMAMI).
// Rastgele seçim YOK.
vi.mock('next/navigation', () => ({
  useParams: () => ({ mode: 'suresiz' }),
  useSearchParams: () => new URLSearchParams('konu=Test&step=165&ders=42'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/practice/practiceApi', () => ({
  fetchLessonScores: vi.fn().mockResolvedValue(null),
  submitPracticeResult: vi.fn().mockResolvedValue({ score: 100, best_score: 100, improved: true }),
  submitOdevAnswer: vi.fn(),
  fetchOdevProgress: vi.fn().mockResolvedValue({ total: 0, answered_count: 0, correct_count: 0, completed: false, per_question_correct: [] }),
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

describe('pratik/[mode]/page — "Ödevini Yap" sabit set (madde 2026-09-11)', () => {
  it('question_counts belirlenmişse ödev seti o kadar sorudur (rastgele DEĞİL)', async () => {
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
    await waitFor(() => screen.getByText(/Ödev:/));
    expect(screen.getByText('2')).toBeInTheDocument();
    // "rastgele seçildi" ipucu ödevin ilk çözümünde GÖSTERİLMEZ.
    expect(screen.queryByText(/rastgele/)).not.toBeInTheDocument();
  });

  it('question_counts belirlenmemişse ödev = havuzun TAMAMI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        steps: [{ id: 165, type: 'explanation', content_json: { board_exercises: POOL } }],
      }),
    }));
    render(<PratikPage />);
    await waitFor(() => screen.getByText(/Ödev:/));
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
