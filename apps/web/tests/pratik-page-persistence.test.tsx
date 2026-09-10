import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { sessionKey, loadSession } from '@/lib/play/practiceSession';

vi.mock('next/navigation', () => ({
  useParams: () => ({ mode: 'suresiz' }),
  useSearchParams: () => new URLSearchParams('konu=Test&step=165&ders=42'),
  // "Pratiği Bırak" düğmesi /home'a yönlendiriyor — sayfa artık useRouter kullanıyor.
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/practice/practiceApi', () => ({
  fetchLessonScores: vi.fn().mockResolvedValue(null),
  submitPracticeResult: vi.fn().mockResolvedValue({ score: 100, best_score: 100, improved: true }),
  submitOdevAnswer: vi.fn().mockResolvedValue({ total: 1, answered_count: 1, correct_count: 1, completed: true, per_question_correct: [true] }),
  fetchOdevProgress: vi.fn().mockResolvedValue({ total: 1, answered_count: 0, correct_count: 0, completed: false, per_question_correct: [] }),
}));

import PratikPage from '@/app/(child)/pratik/[mode]/page';

const EX = {
  type: 'sentence_question' as const, instruction: 'S?', answer_kind: 'sentence' as const,
  options: ['Y', 'D'], correct_index: 1, code: '001',
};

describe('pratik/[mode]/page — madde 7 (oturum bitince temizlenir)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ steps: [{ id: 165, type: 'explanation', content_json: { board_exercises: [EX] } }] }),
    }));
  });

  it('oturum bittiğinde (tek soruluk set, cevaplanınca) kayıt sessionStorage\'dan silinir', async () => {
    render(<PratikPage />);
    const btn = await screen.findByText('D');
    fireEvent.click(btn);
    await waitFor(() => expect(loadSession(sessionKey(165, 'suresiz'))).toBeNull());
  });
});

describe('pratik/[mode]/page — "Ödevini Yap" seti sunucudan (madde 2026-09-11)', () => {
  it('eski localStorage oturumu ne olursa olsun ödev seti /odev/progress\'ten kurulur, "rastgele" ipucu yok', async () => {
    sessionStorage.setItem('bsa:pratik:165:suresiz', JSON.stringify({
      items: [EX, EX], index: 0, currentAnswer: null, doneCount: 0,
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        steps: [{
          id: 165, type: 'explanation',
          content_json: { board_exercises: [EX, EX, EX, EX, EX] },
        }],
      }),
    }));
    render(<PratikPage />);
    await screen.findByText('D');
    expect(screen.queryByText(/rastgele/)).not.toBeInTheDocument();
    expect(screen.getByText(/Ödev:/)).toBeInTheDocument();
  });
});
