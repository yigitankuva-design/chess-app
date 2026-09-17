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

const livekitMocks = vi.hoisted(() => ({
  isMicrophoneEnabled: false,
  setMicrophoneEnabled: vi.fn(),
}));
vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children }: { children: React.ReactNode }) => <div data-testid="livekit-room">{children}</div>,
  RoomAudioRenderer: () => null,
  useLocalParticipant: () => ({
    isMicrophoneEnabled: livekitMocks.isMicrophoneEnabled,
    localParticipant: { setMicrophoneEnabled: livekitMocks.setMicrophoneEnabled },
  }),
}));

/** Madde 2026-09-17 (Sporcu Ekranı): 3 durum ikonu (El/Mikrofon/Söz Hakkı)
 *  + ok/işaret gösterimi testleri için roomState/roomActions mutable
 *  hale getirildi (dersler-canli-host-page.test.tsx'teki AYNI desen). */
const roomState = vi.hoisted(() => ({
  connected: true, fen: 'FEN', sanHistory: [] as string[], controllerChildId: null as number | null,
  connectedChildIds: [] as number[], pendingRequests: [] as { childId: number; name: string }[],
  chatMessages: [] as { from: string; text: string; isHost: boolean }[], lessonEnded: false,
  muted: false, handRaisedIds: new Set<number>(), floorAnnouncement: null as { name: string; nonce: number } | null,
  arrows: [] as { from: string; to: string; color: string }[], marks: {} as Record<string, string>,
}));
const roomActions = vi.hoisted(() => ({
  sendMove: vi.fn(), grantControl: vi.fn(), revokeControl: vi.fn(), resetBoard: vi.fn(),
  muteChild: vi.fn(), sendChat: vi.fn(), dismissPendingRequest: vi.fn(),
  raiseHand: vi.fn(), grantFloor: vi.fn(), sendArrows: vi.fn(), sendMarks: vi.fn(),
}));
vi.mock('@/lib/useLiveLessonRoom', () => ({
  useLiveLessonRoom: () => ({ ...roomState, ...roomActions }),
}));

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ externalArrows, externalMarks }: {
    externalArrows?: { from: string; to: string; color: string }[]; externalMarks?: Record<string, string>;
  }) => (
    <div data-testid="chess-board"
      data-arrows={JSON.stringify(externalArrows ?? [])} data-marks={JSON.stringify(externalMarks ?? {})} />
  ),
}));

import DerslerCanliJoinPage from '@/app/(child)/dersler-canli/[id]/page';

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.role = 'child';
  mockAuth.userId = 5;
  roomState.controllerChildId = null;
  roomState.muted = false;
  roomState.handRaisedIds = new Set();
  roomState.floorAnnouncement = null;
  roomState.arrows = [];
  roomState.marks = {};
  livekitMocks.isMicrophoneEnabled = false;
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

describe('madde 2026-09-17 (Sporcu Ekranı): 3 durum ikonu', () => {
  async function joinRoom() {
    mocks.requestLiveLessonJoin.mockResolvedValue({ status: 'admitted', token: 't', livekit_url: 'wss://x' });
    render(<DerslerCanliJoinPage />);
    fireEvent.click(screen.getByText('Derse Katıl'));
    await waitFor(() => screen.getByTestId('livekit-room'));
  }

  it('El ikonu: taş yetkisi yoksa kırmızı, varsa yeşil — salt-okunur (tıklanamaz)', async () => {
    await joinRoom();
    expect(screen.getByTitle('Taş oynatma yetkin yok')).toBeInTheDocument();

    roomState.controllerChildId = 5; // ownChildId = mockAuth.userId
    render(<DerslerCanliJoinPage />);
    fireEvent.click(screen.getAllByText('Derse Katıl')[0]);
    await waitFor(() => screen.getAllByTitle('Taş oynatma yetkin var')[0]);
  });

  it('Mikrofon: antrenör susturmadıysa kendi kendine aç/kapa yapılabilir', async () => {
    await joinRoom();
    const micBtn = screen.getByTitle('Mikrofonu aç');
    expect(micBtn).not.toBeDisabled();
    fireEvent.click(micBtn);
    expect(livekitMocks.setMicrophoneEnabled).toHaveBeenCalledWith(true);
  });

  it('Mikrofon: antrenör susturduysa (room.muted) devre dışı, tıklamak setMicrophoneEnabled çağırmaz', async () => {
    roomState.muted = true;
    await joinRoom();
    const micBtn = screen.getByTitle('Antrenör seni sustur');
    expect(micBtn).toBeDisabled();
    fireEvent.click(micBtn);
    expect(livekitMocks.setMicrophoneEnabled).not.toHaveBeenCalled();
  });

  it('"Söz Hakkı İstiyor": turuncuyken tıklayınca raiseHand(true), maviyken tıklayınca raiseHand(false)', async () => {
    await joinRoom();
    fireEvent.click(screen.getByTitle('Söz hakkı iste'));
    expect(roomActions.raiseHand).toHaveBeenCalledWith(true);

    roomActions.raiseHand.mockClear();
    roomState.handRaisedIds = new Set([5]);
    render(<DerslerCanliJoinPage />);
    fireEvent.click(screen.getAllByText('Derse Katıl')[0]);
    await waitFor(() => screen.getAllByTitle('Söz hakkı isteğini iptal et')[0]);
    fireEvent.click(screen.getAllByTitle('Söz hakkı isteğini iptal et')[0]);
    expect(roomActions.raiseHand).toHaveBeenCalledWith(false);
  });

  it('floorAnnouncement gelince tarayıcının sesli okuma özelliği (Web Speech API) çağrılır', async () => {
    const speak = vi.fn();
    const utteranceCtor = vi.fn().mockImplementation((text: string) => ({ text, lang: '' }));
    vi.stubGlobal('speechSynthesis', { speak });
    vi.stubGlobal('SpeechSynthesisUtterance', utteranceCtor);

    roomState.floorAnnouncement = { name: 'Defne Hüma', nonce: 1 };
    await joinRoom();

    await waitFor(() => expect(speak).toHaveBeenCalled());
    expect(utteranceCtor).toHaveBeenCalledWith('Defne Hüma, söz hakkı senin, konuşabilirsin');

    vi.unstubAllGlobals();
  });

  it('madde 2026-09-17: antrenörün ok/daire işaretleri ChessBoard\'a externalArrows/externalMarks olarak geçirilir', async () => {
    roomState.arrows = [{ from: 'e2', to: 'e4', color: 'green' }];
    roomState.marks = { e4: 'red' };
    await joinRoom();
    const board = screen.getByTestId('chess-board');
    expect(board).toHaveAttribute('data-arrows', JSON.stringify([{ from: 'e2', to: 'e4', color: 'green' }]));
    expect(board).toHaveAttribute('data-marks', JSON.stringify({ e4: 'red' }));
  });
});
