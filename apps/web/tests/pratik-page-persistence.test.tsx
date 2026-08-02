import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { sessionKey, loadSession } from '@/lib/play/practiceSession';

vi.mock('next/navigation', () => ({
  useParams: () => ({ mode: 'suresiz' }),
  useSearchParams: () => new URLSearchParams('konu=Test&step=165&ders=42'),
}));
vi.mock('@/lib/practice/practiceApi', () => ({
  fetchLessonScores: vi.fn().mockResolvedValue(null),
  submitPracticeResult: vi.fn().mockResolvedValue({ score: 100, best_score: 100, improved: true }),
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

describe('pratik/[mode]/page — bayat oturum otomatik yenilenir (madde 4)', () => {
  it('kayıtlı oturum (2 soru) havuz büyüyünce (5 soru) yok sayılır, TÜM havuz gösterilir', async () => {
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
    // getByText sıfır eşleşmede fırlatır — queryByText null döner, .not.toBeInTheDocument() ile uyumlu.
    expect(screen.queryByText(/5 soruluk havuzdan/)).not.toBeInTheDocument();
  });
});
