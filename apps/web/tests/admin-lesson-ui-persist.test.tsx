import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ lessonId: '7' }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/components/admin/ExerciseForm', () => ({
  ExerciseForm: () => <div data-testid="exercise-form" />,
}));

import AdminStepEditorPage from '@/app/admin/content/lesson/[lessonId]/page';

const STEPS = [
  {
    id: 1, lesson_id: 7, order_index: 1, type: 'explanation',
    content_json: { title: 'Piyon Hareketleri', board_exercises: [], board_exercises_timed: [], board_exercises_test: [] },
    correct_answer_json: null,
  },
];

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(STEPS) }),
  ) as unknown as typeof fetch);
});

describe('Admin ders sayfası — F5 sonrası pozisyon korunur (madde 2)', () => {
  it('alt konu ve mod açıldığında sessionStorage’a yazılır', async () => {
    render(<AdminStepEditorPage />);
    await waitFor(() => screen.getByText('Piyon Hareketleri'));

    fireEvent.click(screen.getByText(/Sorular/));
    await waitFor(() => screen.getByText('Süresiz Pratik Yap'));
    fireEvent.click(screen.getByText('Süresiz Pratik Yap'));

    await waitFor(() => {
      const raw = sessionStorage.getItem('bsa:admin-ders:7');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.openExercises).toBe(1);
      expect(parsed.openMode).toEqual({ stepId: 1, field: 'board_exercises' });
    });
  });

  it('sayfa YENİDEN kurulunca (F5 simülasyonu) aynı mod açık gelir', async () => {
    sessionStorage.setItem('bsa:admin-ders:7', JSON.stringify({
      openExercises: 1,
      openMode: { stepId: 1, field: 'board_exercises_timed' },
      editingExercise: null,
    }));

    render(<AdminStepEditorPage />);
    await waitFor(() => screen.getByText('Piyon Hareketleri'));

    // "Süreli Pratik Yap" kartı zaten acik gorunmeli — form elemani cizilir.
    await waitFor(() => expect(screen.getByTestId('exercise-form')).toBeInTheDocument());
  });

  it('kayıt yoksa (ilk giriş) hiçbir şey açık gelmez', async () => {
    render(<AdminStepEditorPage />);
    await waitFor(() => screen.getByText('Piyon Hareketleri'));
    expect(screen.queryByTestId('exercise-form')).not.toBeInTheDocument();
  });
});
