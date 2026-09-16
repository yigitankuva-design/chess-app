import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/** Madde 2026-09-15 (Online Dersler): antrenörün ders odası. LiveKit'in
 *  gerçek video/ses hattı test edilmiyor (`LiveKitRoom`/`RoomAudioRenderer`/
 *  `useTracks`/`VideoTrack` mock'lanır) — SADECE bu sayfanın kendi mantığı
 *  (katılım isteği onay/red, yetki devri, sohbet, dersi sonlandırma).
 */
const routerPush = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '7' }),
  useRouter: () => ({ push: routerPush }),
}));

const mockAuth = vi.hoisted(() => ({ role: 'teacher' as string | null }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => mockAuth }));

const mocks = vi.hoisted(() => ({
  fetchLiveLesson: vi.fn(),
  startLiveLesson: vi.fn(),
  endLiveLesson: vi.fn(),
  admitLiveLessonParticipant: vi.fn(),
  fetchClassStudents: vi.fn(),
}));
vi.mock('@/lib/liveLessonsApi', () => ({
  fetchLiveLesson: mocks.fetchLiveLesson,
  startLiveLesson: mocks.startLiveLesson,
  endLiveLesson: mocks.endLiveLesson,
  admitLiveLessonParticipant: mocks.admitLiveLessonParticipant,
}));
vi.mock('@/lib/homeworkApi', () => ({ fetchClassStudents: mocks.fetchClassStudents }));

vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children }: { children: React.ReactNode }) => <div data-testid="livekit-room">{children}</div>,
  RoomAudioRenderer: () => null,
  VideoTrack: () => null,
  useTracks: () => [],
}));
vi.mock('livekit-client', () => ({ Track: { Source: { Camera: 'camera' } } }));

const roomState = vi.hoisted(() => ({
  connected: true, fen: 'FEN', sanHistory: [] as string[], controllerChildId: null as number | null,
  connectedChildIds: [11] as number[], pendingRequests: [] as { childId: number; name: string }[],
  chatMessages: [] as { from: string; text: string; isHost: boolean }[], lessonEnded: false, muted: false,
  mutedChildIds: new Set<number>(), handRaises: [] as number[],
}));
const roomActions = vi.hoisted(() => ({
  sendMove: vi.fn(), grantControl: vi.fn(), revokeControl: vi.fn(), resetBoard: vi.fn(),
  muteChild: vi.fn(), muteAll: vi.fn(), raiseHand: vi.fn(), sendChat: vi.fn(),
  dismissPendingRequest: vi.fn(), dismissHandRaise: vi.fn(),
}));
vi.mock('@/lib/useLiveLessonRoom', () => ({
  useLiveLessonRoom: () => ({ ...roomState, ...roomActions }),
}));

vi.mock('@/components/ChessBoard', () => ({ ChessBoard: () => <div data-testid="chess-board" /> }));

import DerslerCanliHostPage from '@/app/(teacher)/coach/dersler-canli/[id]/page';

const LESSON = {
  id: 7, class_id: 1, title: 'Açılış Dersi', scheduled_at: '2026-09-20T10:00:00',
  duration_minutes: 45, join_mode: 'approval' as const, status: 'scheduled' as const,
  started_at: null, ended_at: null,
};
const STUDENTS = [{ id: 11, display_name: 'Ali', avatar: 'default', age: 10, nickname: null, photo_data_url: null, order_index: 0 }];

beforeEach(() => {
  vi.clearAllMocks();
  routerPush.mockClear();
  mockAuth.role = 'teacher';
  roomState.pendingRequests = [];
  roomState.connectedChildIds = [11];
  roomState.controllerChildId = null;
  roomState.chatMessages = [];
  roomState.mutedChildIds = new Set();
  roomState.handRaises = [];
  mocks.fetchLiveLesson.mockResolvedValue(LESSON);
  mocks.fetchClassStudents.mockResolvedValue(STUDENTS);
  mocks.startLiveLesson.mockResolvedValue({ token: 't', livekit_url: 'wss://x' });
});

it('rol antrenör değilse erişim mesajı gösterir', () => {
  mockAuth.role = 'parent';
  render(<DerslerCanliHostPage />);
  expect(screen.getByText('Bu sayfa yalnızca antrenörler içindir.')).toBeInTheDocument();
});

it('yüklenince dersi başlatır, başlığı gösterir', async () => {
  render(<DerslerCanliHostPage />);
  await waitFor(() => expect(mocks.startLiveLesson).toHaveBeenCalledWith(7));
  await waitFor(() => screen.getByText('Açılış Dersi'));
  expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
});

it('LiveKit sunucusuna bağlanılamazsa hata gösterir', async () => {
  mocks.startLiveLesson.mockResolvedValue(null);
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByText(/Derse bağlanılamadı/));
});

it('katılımcı satırında öğrenci adı gösterilir, yetki verme/susturma ikonları çalışır (madde 2026-09-16, Faz A)', async () => {
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByText('Ali'));

  fireEvent.click(screen.getByTitle('Taş oynatma yetkisi ver'));
  expect(roomActions.grantControl).toHaveBeenCalledWith(11);

  fireEvent.click(screen.getByTitle('Sustur'));
  expect(roomActions.muteChild).toHaveBeenCalledWith(11, true);
});

it('yetki verilen öğrencide ikon "Taş yetkisini al"a döner', async () => {
  roomState.controllerChildId = 11;
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByTitle('Taş yetkisini al'));
  fireEvent.click(screen.getByTitle('Taş yetkisini al'));
  expect(roomActions.revokeControl).toHaveBeenCalled();
});

it('susturulmuş öğrencide ikon "Sesi aç"a döner ve tıklayınca açar', async () => {
  roomState.mutedChildIds = new Set([11]);
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByTitle('Sesi aç'));
  fireEvent.click(screen.getByTitle('Sesi aç'));
  expect(roomActions.muteChild).toHaveBeenCalledWith(11, false);
});

it('"Hepsini Kapat" tüm katılımcıları susturur', async () => {
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByText('Hepsini Kapat'));
  fireEvent.click(screen.getByText('Hepsini Kapat'));
  expect(roomActions.muteAll).toHaveBeenCalled();
});

it('"söz hakkı istiyor" bildirimi öğrenci adıyla görünür ve tıklayınca kapanır', async () => {
  roomState.handRaises = [11];
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByText('Ali söz hakkı istiyor'));
  fireEvent.click(screen.getByText('Ali söz hakkı istiyor'));
  expect(roomActions.dismissHandRaise).toHaveBeenCalledWith(11);
});

it('katılım isteği kabul/red edilince ilgili API çağrılır ve istek kaldırılır', async () => {
  roomState.pendingRequests = [{ childId: 22, name: 'Zeynep' }];
  mocks.admitLiveLessonParticipant.mockResolvedValue(true);
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByText('Zeynep'));

  fireEvent.click(screen.getByText('Kabul Et'));
  await waitFor(() => expect(mocks.admitLiveLessonParticipant).toHaveBeenCalledWith(7, 22, true));
  expect(roomActions.dismissPendingRequest).toHaveBeenCalledWith(22);
});

it('sohbete mesaj yazıp gönderince sendChat çağrılır', async () => {
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByPlaceholderText('Mesaj yaz…'));
  fireEvent.change(screen.getByPlaceholderText('Mesaj yaz…'), { target: { value: 'Herkese selam' } });
  fireEvent.click(screen.getByText('Gönder'));
  expect(roomActions.sendChat).toHaveBeenCalledWith('Herkese selam');
});
