import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Madde 2026-09-11 (Ödev Sistemi, Faz 1): "Ödevini Yap" (board_exercises)
// modunda BAŞARI PUANI kalktı — sadece "Soru Sayısı" var, sporcu havuzdaki
// tüm soruları cevaplayınca ödev tamamlanır. Süreli Pratik Yap / Kendini
// Test Et'te başarı puanı DURUYOR.
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ lessonId: '7' }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/components/admin/ExerciseForm', () => ({
  ExerciseForm: () => <div data-testid="exercise-form" />,
}));

import AdminStepEditorPage from '@/app/admin/content/lesson/[lessonId]/page';

function stepsWith(count?: number, score?: number) {
  return [
    {
      id: 1, lesson_id: 7, order_index: 1, type: 'explanation',
      content_json: {
        title: 'Piyon Hareketleri',
        board_exercises: [
          { type: 'click_square', instruction: 'e4', target_squares: ['e4'], difficulty: 1 },
          { type: 'click_square', instruction: 'e5', target_squares: ['e5'], difficulty: 5 },
        ],
        board_exercises_timed: [
          { type: 'click_square', instruction: 't1', target_squares: ['t1'] },
        ],
        board_exercises_test: [],
        ...(count !== undefined ? { question_counts: { board_exercises: count } } : {}),
        ...(score !== undefined ? { success_scores: { board_exercises: score } } : {}),
      },
      correct_answer_json: null,
    },
  ];
}

async function openMode(steps: unknown[], modeLabel: string) {
  vi.stubGlobal('fetch', vi.fn((_url: string, opts?: RequestInit) => {
    if (opts?.method === 'PATCH') return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(steps) });
  }) as unknown as typeof fetch);
  render(<AdminStepEditorPage />);
  await waitFor(() => screen.getByText('Piyon Hareketleri'));
  fireEvent.click(screen.getByText(/Sorular/));
  await waitFor(() => screen.getByText(modeLabel));
  fireEvent.click(screen.getByText(modeLabel));
  await waitFor(() => screen.getByText('Soru Sayısını Belirle'));
}

function patchCall() {
  const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
  return calls.find((c: unknown[]) => (c[1] as RequestInit)?.method === 'PATCH');
}

beforeEach(() => { sessionStorage.clear(); });

describe('Admin ders sayfası — "Ödevini Yap": sadece Soru Sayısı (Başarı Puanı YOK)', () => {
  it('"Ödevini Yap"ta Başarı Puanı Belirle kutusu GÖSTERİLMEZ', async () => {
    await openMode(stepsWith(), 'Ödevini Yap');
    expect(screen.getByLabelText('Soru Sayısını Belirle')).toBeInTheDocument();
    expect(screen.queryByLabelText('Başarı Puanı Belirle')).not.toBeInTheDocument();
  });

  it('soru sayısı girilince SADECE question_counts kaydedilir, eski success_scores.board_exercises temizlenir', async () => {
    await openMode(stepsWith(undefined, 85), 'Ödevini Yap'); // eski puan kaydı var
    fireEvent.change(screen.getByLabelText('Soru Sayısını Belirle'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => {
      const pc = patchCall();
      expect(pc).toBeTruthy();
      const body = JSON.parse((pc![1] as RequestInit).body as string);
      expect(body.content_json.question_counts).toEqual({ board_exercises: 2 });
      expect(body.content_json.success_scores.board_exercises).toBeUndefined();
    });
  });

  it('havuzdan fazla sayı girilirse kaydedilmez, uyarı gösterilir', async () => {
    await openMode(stepsWith(), 'Ödevini Yap');
    fireEvent.change(screen.getByLabelText('Soru Sayısını Belirle'), { target: { value: '5' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => screen.getByText(/havuzdaki soru sayısından \(2\) fazla olamaz/));
    expect(patchCall()).toBeFalsy();
  });

  it('soru sayısı boşken Kaydet basınca kaydedilmez, uyarı gösterilir', async () => {
    await openMode(stepsWith(2), 'Ödevini Yap');
    fireEvent.change(screen.getByLabelText('Soru Sayısını Belirle'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => screen.getByText(/girilmeli/));
    expect(patchCall()).toBeFalsy();
  });

  it('kaydedilmiş sayı havuzdan büyük kalırsa bilgilendirme notu görünür', async () => {
    await openMode(stepsWith(5), 'Ödevini Yap'); // havuzda 2 soru, kaydedilen 5
    expect(screen.getByText(/Belirlediğin sayı \(5\) havuzdaki soru sayısından \(2\) fazla/)).toBeInTheDocument();
  });
});

describe('Admin ders sayfası — Süreli Pratik Yap / Kendini Test Et: Başarı Puanı DURUYOR (regresyon)', () => {
  it('"Süreli Pratik Yap"ta Başarı Puanı Belirle kutusu HÂLÂ var ve ikisi birlikte kaydedilir', async () => {
    await openMode(stepsWith(), 'Süreli Pratik Yap');
    expect(screen.getByLabelText('Başarı Puanı Belirle')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Soru Sayısını Belirle'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Başarı Puanı Belirle'), { target: { value: '80' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => {
      const pc = patchCall();
      expect(pc).toBeTruthy();
      const body = JSON.parse((pc![1] as RequestInit).body as string);
      expect(body.content_json.question_counts).toEqual({ board_exercises_timed: 1 });
      expect(body.content_json.success_scores).toEqual({ board_exercises_timed: 80 });
    });
  });
});
