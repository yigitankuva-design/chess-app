import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/** Madde 2026-09-15 (Online Dersler): sporcunun katılım ekranı. LiveKit'in
 *  gerçek bağlantısı (video/ses) burada test edilmiyor — `LiveKitRoom`/
 *  `RoomAudioRenderer` ve `useLiveLessonRoom`/`ChessBoard` mock'lanır,
 *  SADECE bu sayfanın kendi durum makinesi (idle/pending/denied/admitted)
 *  test edilir. */
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '42' }),
  useRouter: () => ({ push: vi.fn() }),
}));

const mockAuth = vi.hoisted(() => ({ role: 'child' as string | null, userId: 5 as number | null }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => mockAuth }));

const mocks = vi.hoisted(() => ({
  requestLiveLessonJoin: vi.fn(),
  pollLiveLessonJoinStatus: vi.fn(),
  leaveLiveLesson: vi.fn(),
}));
vi.mock('@/lib/liveLessonsApi', () => mocks);

vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children }: { children: React.ReactNode }) => <div data-testid="livekit-room">{children}</div>,
  RoomAudioRenderer: () => null,
}));

vi.mock('@/lib/useLiveLessonRoom', () => ({
  useLiveLessonRoom: () => ({
    connected: true, fen: 'FEN', sanHistory: [], controllerChildId: null,
    connectedChildIds: [], pendingRequests: [], chatMessages: [], lessonEnded: false,
    muted: false,
    sendMove: vi.fn(), grantControl: vi.fn(), revokeControl: vi.fn(), resetBoard: vi.fn(),
    muteChild: vi.fn(), sendChat: vi.fn(), dismissPendingRequest: vi.fn(),
  }),
}));

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: () => <div data-testid="chess-board" />,
}));

import DerslerCanliJoinPage from '@/app/(child)/dersler-canli/[id]/page';

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.role = 'child';
  mockAuth.userId = 5;
});

afterEach(() => {
  vi.useRealTimers();
});

it('rol antrenör/sporcu değilse erişim mesajı gösterir', () => {
  mockAuth.role = 'parent';
  render(<DerslerCanliJoinPage />);
  expect(screen.getByText('Bu sayfa yalnızca sporcular içindir.')).toBeInTheDocument();
});

it('"Derse Katıl" — auto modda anında bağlanır', async () => {
  mocks.requestLiveLessonJoin.mockResolvedValue({ status: 'admitted', token: 't', livekit_url: 'wss://x' });
  render(<DerslerCanliJoinPage />);
  fireEvent.click(screen.getByText('Derse Katıl'));

  await waitFor(() => expect(screen.getByTestId('livekit-room')).toBeInTheDocument());
  expect(screen.getByText('Dersten Ayrıl')).toBeInTheDocument();
});

it('"Derse Katıl" — approval modda önce bekleme ekranı gösterir', async () => {
  mocks.requestLiveLessonJoin.mockResolvedValue({ status: 'pending' });
  mocks.pollLiveLessonJoinStatus.mockResolvedValue({ status: 'pending' });
  render(<DerslerCanliJoinPage />);
  fireEvent.click(screen.getByText('Derse Katıl'));

  await waitFor(() => screen.getByText('Antrenörünün onayı bekleniyor…'));
});

it('bekleme sırasında antrenör onaylarsa (poll admitted) derse bağlanır', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mocks.requestLiveLessonJoin.mockResolvedValue({ status: 'pending' });
  mocks.pollLiveLessonJoinStatus.mockResolvedValue({ status: 'admitted', token: 't', livekit_url: 'wss://x' });

  render(<DerslerCanliJoinPage />);
  fireEvent.click(screen.getByText('Derse Katıl'));
  await waitFor(() => screen.getByText('Antrenörünün onayı bekleniyor…'));

  await vi.advanceTimersByTimeAsync(2100);
  await waitFor(() => expect(screen.getByTestId('livekit-room')).toBeInTheDocument());
});

it('bekleme sırasında antrenör reddederse (poll denied) uyarı gösterir', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mocks.requestLiveLessonJoin.mockResolvedValue({ status: 'pending' });
  mocks.pollLiveLessonJoinStatus.mockResolvedValue({ status: 'denied' });

  render(<DerslerCanliJoinPage />);
  fireEvent.click(screen.getByText('Derse Katıl'));
  await waitFor(() => screen.getByText('Antrenörünün onayı bekleniyor…'));

  await vi.advanceTimersByTimeAsync(2100);
  await waitFor(() => screen.getByText('Antrenörün katılım isteğini kabul etmedi.'));
});

it('requestLiveLessonJoin ağ hatasında (null) hata mesajı gösterir', async () => {
  mocks.requestLiveLessonJoin.mockResolvedValue(null);
  render(<DerslerCanliJoinPage />);
  fireEvent.click(screen.getByText('Derse Katıl'));
  await waitFor(() => screen.getByText('Derse bağlanılamadı. Az sonra tekrar dene.'));
});

it('"Dersten Ayrıl" — leaveLiveLesson çağırır, katılım ekranına döner', async () => {
  mocks.requestLiveLessonJoin.mockResolvedValue({ status: 'admitted', token: 't', livekit_url: 'wss://x' });
  mocks.leaveLiveLesson.mockResolvedValue(true);
  render(<DerslerCanliJoinPage />);
  fireEvent.click(screen.getByText('Derse Katıl'));
  await waitFor(() => screen.getByText('Dersten Ayrıl'));

  fireEvent.click(screen.getByText('Dersten Ayrıl'));
  await waitFor(() => expect(mocks.leaveLiveLesson).toHaveBeenCalledWith(42));
  await waitFor(() => screen.getByText('Derse Katıl'));
});
