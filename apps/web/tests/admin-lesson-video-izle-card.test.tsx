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

describe('Admin ders sayfası — Alt Konu 2×2 kart ızgarası (madde 2026-09-05: Video İzle + Ödevini Yap)', () => {
  it('4 kart görünür: Video İzle, Ödevini Yap, Süreli Pratik Yap, Kendini Test Et', async () => {
    render(<AdminStepEditorPage />);
    await waitFor(() => screen.getByText('Piyon Hareketleri'));
    fireEvent.click(screen.getByText(/Sorular/));

    await waitFor(() => screen.getByText('Video İzle'));
    expect(screen.getByText('Ödevini Yap')).toBeInTheDocument();
    expect(screen.getByText('Süreli Pratik Yap')).toBeInTheDocument();
    expect(screen.getByText('Kendini Test Et')).toBeInTheDocument();
    expect(screen.queryByText('Süresiz Pratik Yap')).not.toBeInTheDocument();
  });

  it('Video İzle kartına tıklamak hiçbir şey açmaz (henüz sadece görsel)', async () => {
    render(<AdminStepEditorPage />);
    await waitFor(() => screen.getByText('Piyon Hareketleri'));
    fireEvent.click(screen.getByText(/Sorular/));
    await waitFor(() => screen.getByText('Video İzle'));

    fireEvent.click(screen.getByText('Video İzle'));
    expect(screen.queryByText('Soru Sayısını Belirle')).not.toBeInTheDocument();
  });
});
