import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ lessonId: '7' }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/components/admin/ExerciseForm', () => ({
  ExerciseForm: () => <div data-testid="exercise-form" />,
}));

import AdminStepEditorPage from '@/app/admin/content/lesson/[lessonId]/page';

function stepsWith(count?: number) {
  return [
    {
      id: 1, lesson_id: 7, order_index: 1, type: 'explanation',
      content_json: {
        title: 'Piyon Hareketleri',
        board_exercises: [
          { type: 'click_square', instruction: 'e4', target_squares: ['e4'], difficulty: 1 },
          { type: 'click_square', instruction: 'e5', target_squares: ['e5'], difficulty: 5 },
        ],
        board_exercises_timed: [],
        board_exercises_test: [],
        ...(count !== undefined ? { question_counts: { board_exercises: count } } : {}),
      },
      correct_answer_json: null,
    },
  ];
}

async function openUntimed(steps: unknown[]) {
  vi.stubGlobal('fetch', vi.fn((_url: string, opts?: RequestInit) => {
    if (opts?.method === 'PATCH') return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(steps) });
  }) as unknown as typeof fetch);
  render(<AdminStepEditorPage />);
  await waitFor(() => screen.getByText('Piyon Hareketleri'));
  fireEvent.click(screen.getByText(/Sorular/));
  await waitFor(() => screen.getByText('Süresiz Pratik Yap'));
  fireEvent.click(screen.getByText('Süresiz Pratik Yap'));
  await waitFor(() => screen.getByText('Soru Sayısını Belirle'));
}

beforeEach(() => {
  sessionStorage.clear();
});

describe('Admin ders sayfası — Soru Sayısını Belirle', () => {
  it('havuz kadar veya az sayı kaydedilir', async () => {
    await openUntimed(stepsWith());
    const input = screen.getByLabelText('Soru Sayısını Belirle');
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const patchCall = calls.find((c: unknown[]) => (c[1] as RequestInit)?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      const body = JSON.parse((patchCall![1] as RequestInit).body as string);
      expect(body.content_json.question_counts).toEqual({ board_exercises: 2 });
    });
  });

  it('havuzdan fazla sayı girilirse kaydedilmez, uyarı gösterilir', async () => {
    await openUntimed(stepsWith());
    const input = screen.getByLabelText('Soru Sayısını Belirle');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => screen.getByText(/havuzdaki soru sayısından \(2\) fazla olamaz/));
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const patchCall = calls.find((c: unknown[]) => (c[1] as RequestInit)?.method === 'PATCH');
    expect(patchCall).toBeFalsy();
  });

  it('kaydedilmiş sayı sonradan havuzdan büyük kalırsa bilgilendirme notu görünür', async () => {
    await openUntimed(stepsWith(5)); // havuzda 2 soru var ama kaydedilen sayı 5
    expect(screen.getByText(/Belirlediğin sayı \(5\) havuzdaki soru sayısından \(2\) fazla/)).toBeInTheDocument();
  });

  it('boş bırakıp Kaydet basınca sayı kaldırılır (eskisi gibi 20 olur)', async () => {
    await openUntimed(stepsWith(2));
    const input = screen.getByLabelText('Soru Sayısını Belirle');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const patchCall = calls.find((c: unknown[]) => (c[1] as RequestInit)?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      const body = JSON.parse((patchCall![1] as RequestInit).body as string);
      expect(body.content_json.question_counts).toEqual({});
    });
  });
});
