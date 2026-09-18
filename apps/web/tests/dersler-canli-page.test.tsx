import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/** Madde 2026-09-15 (Online Dersler): antrenörün ders listesi + oluşturma
 *  formu. */
const routerPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush }) }));

const mockAuth = vi.hoisted(() => ({ role: 'teacher' as string | null, token: 'tok' as string | null }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => mockAuth }));

const mocks = vi.hoisted(() => ({
  fetchMyLiveLessons: vi.fn(),
  createLiveLesson: vi.fn(),
  startLiveLesson: vi.fn(),
  updateLiveLesson: vi.fn(),
  deleteLiveLesson: vi.fn(),
  fetchMyClasses: vi.fn(),
}));
vi.mock('@/lib/liveLessonsApi', () => ({
  fetchMyLiveLessons: mocks.fetchMyLiveLessons,
  createLiveLesson: mocks.createLiveLesson,
  startLiveLesson: mocks.startLiveLesson,
  updateLiveLesson: mocks.updateLiveLesson,
  deleteLiveLesson: mocks.deleteLiveLesson,
}));
vi.mock('@/lib/homeworkApi', () => ({ fetchMyClasses: mocks.fetchMyClasses }));

import DerslerCanliPage from '@/app/(teacher)/coach/dersler-canli/page';

const CLASSES = [{ id: 1, name: 'Sınıf A', join_code: 'X', order_index: 0 }];

beforeEach(() => {
  vi.clearAllMocks();
  routerPush.mockClear();
  mockAuth.role = 'teacher';
  mocks.fetchMyLiveLessons.mockResolvedValue([]);
  mocks.fetchMyClasses.mockResolvedValue(CLASSES);
});

it('rol antrenör değilse erişim mesajı gösterir', () => {
  mockAuth.role = 'parent';
  render(<DerslerCanliPage />);
  expect(screen.getByText('Bu sayfa yalnızca antrenörler içindir.')).toBeInTheDocument();
});

describe('madde 2026-09-19: "Canlı Ders Oluştur" toggle (logo alanı kaldırıldı)', () => {
  it('varsayılan açılışta form GİZLİDİR', async () => {
    render(<DerslerCanliPage />);
    await waitFor(() => screen.getByText('Canlı Dersler'));
    expect(screen.queryByPlaceholderText('Örn. Açılış Dersi')).not.toBeInTheDocument();
  });

  it('"Canlı Ders Oluştur"a tıklayınca form görünür; tekrar tıklayınca kapanır', async () => {
    render(<DerslerCanliPage />);
    await waitFor(() => screen.getByText('Canlı Dersler'));

    fireEvent.click(screen.getByText('Canlı Ders Oluştur'));
    await waitFor(() => screen.getByPlaceholderText('Örn. Açılış Dersi'));

    fireEvent.click(screen.getByText('Canlı Ders Oluştur'));
    expect(screen.queryByPlaceholderText('Örn. Açılış Dersi')).not.toBeInTheDocument();
  });

  it('"Canlı Ders Listesi" her iki durumda da (kapalı/açık form) görünür', async () => {
    mocks.fetchMyLiveLessons.mockResolvedValue([{
      id: 1, class_id: 1, title: 'Mevcut Ders', scheduled_at: '2026-09-20T10:00:00',
      duration_minutes: 30, join_mode: 'auto', status: 'scheduled', started_at: null, ended_at: null,
    }]);
    render(<DerslerCanliPage />);
    await waitFor(() => screen.getByText('Mevcut Ders'));
    expect(screen.getByText('Canlı Ders Listesi')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Canlı Ders Oluştur'));
    await waitFor(() => screen.getByPlaceholderText('Örn. Açılış Dersi'));
    expect(screen.getByText('Canlı Ders Listesi')).toBeInTheDocument();
    expect(screen.getByText('Mevcut Ders')).toBeInTheDocument();
  });
});

it('sınıf yoksa uyarır, dersi yoksa "Henüz bir ders oluşturmadın." gösterir', async () => {
  mocks.fetchMyClasses.mockResolvedValue([]);
  render(<DerslerCanliPage />);
  await waitFor(() => screen.getByText('Canlı Ders Oluştur'));
  fireEvent.click(screen.getByText('Canlı Ders Oluştur'));
  await waitFor(() => screen.getByText('Henüz sınıfın yok. Önce bir sınıf oluştur.'));
  expect(screen.getByText('Henüz bir ders oluşturmadın.')).toBeInTheDocument();
});

it('ders oluşturma — doğru payload ile createLiveLesson çağırır, listeye ekler', async () => {
  mocks.createLiveLesson.mockResolvedValue({
    id: 9, class_id: 1, title: 'Açılış Dersi', scheduled_at: '2026-09-20T10:00:00',
    duration_minutes: 45, join_mode: 'auto', status: 'scheduled', started_at: null, ended_at: null,
  });
  render(<DerslerCanliPage />);
  fireEvent.click(screen.getByText('Canlı Ders Oluştur'));
  await waitFor(() => screen.getByText('Sınıf A'));

  fireEvent.change(screen.getByPlaceholderText('Örn. Açılış Dersi'), { target: { value: 'Açılış Dersi' } });
  fireEvent.click(screen.getByText('Onayım Gerekli'));
  fireEvent.click(screen.getByText('Dersi Oluştur'));

  await waitFor(() => expect(mocks.createLiveLesson).toHaveBeenCalledWith(expect.objectContaining({
    class_id: 1, title: 'Açılış Dersi', duration_minutes: 45, join_mode: 'approval',
  })));
  await waitFor(() => screen.getByText('Açılış Dersi'));
  expect(screen.getByText(/Planlandı/)).toBeInTheDocument();
});

it('başlık boşsa dersi oluşturamaz, hata gösterir', async () => {
  render(<DerslerCanliPage />);
  fireEvent.click(screen.getByText('Canlı Ders Oluştur'));
  await waitFor(() => screen.getByText('Sınıf A'));
  fireEvent.click(screen.getByText('Dersi Oluştur'));
  await waitFor(() => screen.getByText('Ders başlığı gir.'));
  expect(mocks.createLiveLesson).not.toHaveBeenCalled();
});

it('"scheduled" ders için "Dersi Başlat" tıklanınca start çağrılır ve oda sayfasına gidilir', async () => {
  mocks.fetchMyLiveLessons.mockResolvedValue([{
    id: 3, class_id: 1, title: 'Var Olan Ders', scheduled_at: '2026-09-20T10:00:00',
    duration_minutes: 30, join_mode: 'auto', status: 'scheduled', started_at: null, ended_at: null,
  }]);
  mocks.startLiveLesson.mockResolvedValue({ token: 't', livekit_url: 'wss://x' });
  render(<DerslerCanliPage />);
  await waitFor(() => screen.getByText('Var Olan Ders'));

  fireEvent.click(screen.getByText('Dersi Başlat'));
  await waitFor(() => expect(mocks.startLiveLesson).toHaveBeenCalledWith(3));
  expect(routerPush).toHaveBeenCalledWith('/coach/dersler-canli/3');
});

it('"live" ders için "Derse Git" gösterilir, tıklanınca doğrudan oda sayfasına gider', async () => {
  mocks.fetchMyLiveLessons.mockResolvedValue([{
    id: 4, class_id: 1, title: 'Canlı Ders', scheduled_at: '2026-09-20T10:00:00',
    duration_minutes: 30, join_mode: 'auto', status: 'live', started_at: '2026-09-20T10:00:00', ended_at: null,
  }]);
  render(<DerslerCanliPage />);
  await waitFor(() => screen.getByText('Canlı Ders'));
  fireEvent.click(screen.getByText('Derse Git'));
  expect(routerPush).toHaveBeenCalledWith('/coach/dersler-canli/4');
  expect(mocks.startLiveLesson).not.toHaveBeenCalled();
});

it('madde 2026-09-16 (Antrenör Ekranı, Faz A / madde 5): "Derslerim" başlığı düzenlenebilir', async () => {
  mocks.fetchMyLiveLessons.mockResolvedValue([{
    id: 5, class_id: 1, title: 'Eski Başlık', scheduled_at: '2026-09-20T10:00:00',
    duration_minutes: 30, join_mode: 'auto', status: 'scheduled', started_at: null, ended_at: null,
  }]);
  mocks.updateLiveLesson.mockResolvedValue({
    id: 5, class_id: 1, title: 'Yeni Başlık', scheduled_at: '2026-09-20T10:00:00',
    duration_minutes: 30, join_mode: 'auto', status: 'scheduled', started_at: null, ended_at: null,
  });
  render(<DerslerCanliPage />);
  await waitFor(() => screen.getByText('Eski Başlık'));

  fireEvent.click(screen.getByTitle('Başlığı düzenle'));
  const input = screen.getByDisplayValue('Eski Başlık');
  fireEvent.change(input, { target: { value: 'Yeni Başlık' } });
  fireEvent.click(screen.getByText('Kaydet'));

  await waitFor(() => expect(mocks.updateLiveLesson).toHaveBeenCalledWith(5, 'Yeni Başlık'));
  await waitFor(() => screen.getByText('Yeni Başlık'));
  expect(screen.queryByText('Eski Başlık')).not.toBeInTheDocument();
});

it('madde 2026-09-17 (madde 7): "scheduled" dersi silme ikonu onayla siler, listeden kaldırır', async () => {
  vi.stubGlobal('confirm', vi.fn(() => true));
  mocks.fetchMyLiveLessons.mockResolvedValue([{
    id: 6, class_id: 1, title: 'Mükerrer Ders', scheduled_at: '2026-09-20T10:00:00',
    duration_minutes: 30, join_mode: 'auto', status: 'scheduled', started_at: null, ended_at: null,
  }]);
  mocks.deleteLiveLesson.mockResolvedValue(true);
  render(<DerslerCanliPage />);
  await waitFor(() => screen.getByText('Mükerrer Ders'));

  fireEvent.click(screen.getByTitle('Dersi sil'));
  expect(window.confirm).toHaveBeenCalled();
  await waitFor(() => expect(mocks.deleteLiveLesson).toHaveBeenCalledWith(6));
  await waitFor(() => expect(screen.queryByText('Mükerrer Ders')).not.toBeInTheDocument());
});

it('madde 2026-09-17 (madde 7): onaylamayınca silinmez', async () => {
  vi.stubGlobal('confirm', vi.fn(() => false));
  mocks.fetchMyLiveLessons.mockResolvedValue([{
    id: 7, class_id: 1, title: 'Kalacak Ders', scheduled_at: '2026-09-20T10:00:00',
    duration_minutes: 30, join_mode: 'auto', status: 'scheduled', started_at: null, ended_at: null,
  }]);
  render(<DerslerCanliPage />);
  await waitFor(() => screen.getByText('Kalacak Ders'));

  fireEvent.click(screen.getByTitle('Dersi sil'));
  expect(mocks.deleteLiveLesson).not.toHaveBeenCalled();
  expect(screen.getByText('Kalacak Ders')).toBeInTheDocument();
});

it('madde 2026-09-17 (madde 7): "live" ders için silme ikonu hiç gösterilmez', async () => {
  mocks.fetchMyLiveLessons.mockResolvedValue([{
    id: 8, class_id: 1, title: 'Devam Eden Ders', scheduled_at: '2026-09-20T10:00:00',
    duration_minutes: 30, join_mode: 'auto', status: 'live', started_at: '2026-09-20T10:00:00', ended_at: null,
  }]);
  render(<DerslerCanliPage />);
  await waitFor(() => screen.getByText('Devam Eden Ders'));
  expect(screen.queryByTitle('Dersi sil')).not.toBeInTheDocument();
});
