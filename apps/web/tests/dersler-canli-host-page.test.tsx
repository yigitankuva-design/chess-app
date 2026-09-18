import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

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
  fetchLiveLessonUsageEstimate: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/liveLessonsApi', () => ({
  fetchLiveLesson: mocks.fetchLiveLesson,
  startLiveLesson: mocks.startLiveLesson,
  endLiveLesson: mocks.endLiveLesson,
  admitLiveLessonParticipant: mocks.admitLiveLessonParticipant,
  fetchLiveLessonUsageEstimate: mocks.fetchLiveLessonUsageEstimate,
}));
vi.mock('@/lib/homeworkApi', () => ({ fetchClassStudents: mocks.fetchClassStudents }));

const localParticipantMocks = vi.hoisted(() => ({
  setMicrophoneEnabled: vi.fn(),
}));
vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children }: { children: React.ReactNode }) => <div data-testid="livekit-room">{children}</div>,
  RoomAudioRenderer: () => null,
  VideoTrack: () => null,
  useTracks: () => [],
  useLocalParticipant: () => ({
    localParticipant: localParticipantMocks, isMicrophoneEnabled: true,
  }),
}));
vi.mock('livekit-client', () => ({ Track: { Source: { Camera: 'camera' } } }));

const roomState = vi.hoisted(() => ({
  connected: true, fen: 'FEN', sanHistory: [] as string[], controllerChildId: null as number | null,
  connectedChildIds: [11] as number[], pendingRequests: [] as { childId: number; name: string }[],
  chatMessages: [] as { from: string; text: string; isHost: boolean }[], lessonEnded: false, muted: false,
  mutedChildIds: new Set<number>(), handRaisedIds: new Set<number>(),
  arrows: [] as { from: string; to: string; color: string }[], marks: {} as Record<string, string>,
}));
const roomActions = vi.hoisted(() => ({
  sendMove: vi.fn(), grantControl: vi.fn(), revokeControl: vi.fn(), resetBoard: vi.fn(),
  muteChild: vi.fn(), muteAll: vi.fn(), raiseHand: vi.fn(), grantFloor: vi.fn(), sendChat: vi.fn(),
  dismissPendingRequest: vi.fn(),
  sendArrows: vi.fn(), sendMarks: vi.fn(),
}));
vi.mock('@/lib/useLiveLessonRoom', () => ({
  useLiveLessonRoom: () => ({ ...roomState, ...roomActions }),
}));

const chessBoardMocks = vi.hoisted(() => ({ lastProps: null as Record<string, unknown> | null }));
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: (props: Record<string, unknown>) => {
    chessBoardMocks.lastProps = props;
    return <div data-testid="chess-board" />;
  },
}));

// Madde 2026-09-16 (Antrenör Ekranı, Faz B): Konum Tahtası + değerlendirme
// çubuğu için gerçek Stockfish worker'ı/gerçek BoardEditor'ı test etmiyoruz
// (LiveKit ses/görüntüsü gibi burada da SADECE bu sayfanın kendi mantığı).
const stockfishMocks = vi.hoisted(() => ({
  init: vi.fn().mockResolvedValue(undefined),
  setSkill: vi.fn(),
  analyze: vi.fn().mockResolvedValue({ bestMove: null, scoreCp: 200, mate: null }),
  destroy: vi.fn(),
}));
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: vi.fn().mockImplementation(() => stockfishMocks),
}));

const boardEditorMocks = vi.hoisted(() => ({ lastProps: null as Record<string, unknown> | null }));
vi.mock('@/components/BoardEditor', () => ({
  BoardEditor: (props: { onChange: (fen: string) => void }) => {
    boardEditorMocks.lastProps = props;
    return (
      <div data-testid="board-editor">
        <button type="button" onClick={() => props.onChange('KONUM_FEN')}>BoardEditor değişti</button>
      </div>
    );
  },
  START_FEN: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  EMPTY_FEN: '8/8/8/8/8/8/8/8 w - - 0 1',
}));

// Madde 2026-09-16 (Antrenör Ekranı, Faz C): "Anlatım Tahtası" — Düzey/Konu/
// Alt Konu ağacı + Alt Konu içeriği + Ödev Gönder, gerçek bileşenler AYRI
// dosyalarda zaten test ediliyor (nested-section-accordion-select-alt-konu,
// alt-konu-walkthrough, odev-gonder-page); burada SADECE bu sayfanın onları
// doğru prop'larla bağlayıp bağlamadığı test edilir.
const customTabsMocks = vi.hoisted(() => ({
  listCustomTabs: vi.fn(),
  getCustomTab: vi.fn(),
}));
vi.mock('@/lib/customTabsApi', () => customTabsMocks);

vi.mock('@/components/custom/NestedSectionAccordion', () => ({
  NestedSectionAccordion: ({ onSelectAltKonu }: { onSelectAltKonu?: (id: number) => void }) => (
    <div data-testid="accordion">
      <button type="button" onClick={() => onSelectAltKonu?.(203)}>Tahtanın Genel Özellikleri</button>
    </div>
  ),
}));

vi.mock('@/components/custom/AltKonuWalkthrough', () => ({
  AltKonuWalkthrough: ({ sourceSectionTitle, onStepChange, onSendHomework }: {
    sourceSectionTitle?: string; onStepChange?: (fen: string) => void; onSendHomework?: () => void;
  }) => (
    <div data-testid="alt-konu-walkthrough">
      {sourceSectionTitle}
      <button type="button" onClick={() => onStepChange?.('STEP_FEN')}>Adım Değiştir</button>
      <button type="button" onClick={() => onSendHomework?.()}>Ödev Gönder</button>
    </div>
  ),
}));

vi.mock('@/components/OdevGonderInner', () => ({
  OdevGonderInner: ({ sectionId, onClose }: { sectionId: number; onClose?: () => void }) => (
    <div data-testid="odev-gonder-inner">
      Ödev Gönder Paneli #{sectionId}
      <button type="button" onClick={onClose}>Kapat</button>
    </div>
  ),
}));

import DerslerCanliHostPage from '@/app/(teacher)/coach/dersler-canli/[id]/page';

const CALISMALAR_TAB = {
  id: 9, label: 'Çalışmalar', emoji: '⭐', kind: 'antrenor_calismalar',
  sections: [{
    id: 203, order_index: 1, title: 'Tahtanın Genel Özellikleri', body: '', images: [],
    practice_positions: [], parent_id: null,
  }],
};

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
  roomState.handRaisedIds = new Set();
  roomState.arrows = [];
  roomState.marks = {};
  mocks.fetchLiveLesson.mockResolvedValue(LESSON);
  mocks.fetchClassStudents.mockResolvedValue(STUDENTS);
  mocks.startLiveLesson.mockResolvedValue({ token: 't', livekit_url: 'wss://x' });
  mocks.fetchLiveLessonUsageEstimate.mockResolvedValue(null);
  customTabsMocks.listCustomTabs.mockResolvedValue([
    { id: 9, order_index: 1, label: 'Çalışmalar', emoji: '⭐', kind: 'antrenor_calismalar' },
  ]);
  customTabsMocks.getCustomTab.mockResolvedValue(CALISMALAR_TAB);
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

it('madde 2026-09-17 ("Söz Hakkı İstiyor" v2): istek yokken ikon turuncu ve devre dışı', async () => {
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByTitle('Söz hakkı istemiyor'));
  expect(screen.getByTitle('Söz hakkı istemiyor')).toBeDisabled();
  fireEvent.click(screen.getByTitle('Söz hakkı istemiyor'));
  expect(roomActions.grantFloor).not.toHaveBeenCalled();
});

it('madde 2026-09-17: sporcu söz istediğinde ikon+isim mavi olur, tıklayınca grantFloor çağrılır', async () => {
  roomState.handRaisedIds = new Set([11]);
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByTitle('Söz hakkı ver'));
  expect(screen.getByTitle('Söz hakkı ver')).not.toBeDisabled();
  expect(screen.getByText('Ali')).toHaveStyle({ color: '#2563eb' });
  fireEvent.click(screen.getByTitle('Söz hakkı ver'));
  expect(roomActions.grantFloor).toHaveBeenCalledWith(11);
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

it('madde 2026-09-16 (Antrenör Ekranı, Faz B): varsayılan Analiz Tahtası modunda tahta+değerlendirme çubuğu görünür', async () => {
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByTestId('chess-board'));
  const meter = screen.getByRole('meter', { name: 'Değerlendirme çubuğu' });
  expect(meter).toBeInTheDocument();
  // (Mock) Stockfish sonucu geldikten sonra çubuk güncellenir — bu bekleme
  // aynı zamanda efektin act() dışında çözülmesini engelliyor.
  await waitFor(() => expect(meter).toHaveAttribute('aria-valuenow', '76'));
  expect(screen.queryByTestId('board-editor')).not.toBeInTheDocument();
  // Madde 2026-09-18: antrenör ekranında showMarker açık — mavi işaretleyici
  // + değer etiketi görünür (mock scoreCp=200 → "+2,0").
  expect(screen.getByText('+2,0')).toBeInTheDocument();
});

it('"Konum Tahtası"na geçince BoardEditor görünür, tahta kaybolur; onChange resetBoard çağırır', async () => {
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByTestId('chess-board'));
  // Değerlendirme çubuğunun ilk (mock) Stockfish hesaplaması act() dışında
  // çözülmesin diye önce yerleşmesini bekliyoruz.
  await waitFor(() => expect(screen.getByRole('meter', { name: 'Değerlendirme çubuğu' })).toHaveAttribute('aria-valuenow', '76'));

  fireEvent.click(screen.getByText('Konum Tahtası'));
  expect(screen.queryByTestId('chess-board')).not.toBeInTheDocument();
  expect(screen.getByTestId('board-editor')).toBeInTheDocument();

  fireEvent.click(screen.getByText('BoardEditor değişti'));
  expect(roomActions.resetBoard).toHaveBeenCalledWith('KONUM_FEN');

  fireEvent.click(screen.getByText('Analiz Tahtası'));
  expect(screen.getByTestId('chess-board')).toBeInTheDocument();
  expect(screen.queryByTestId('board-editor')).not.toBeInTheDocument();
  // Analiz moduna dönünce değerlendirme efekti tekrar tetiklenir — testin
  // sonunda act() dışında çözülmesin diye bekliyoruz.
  await waitFor(() => expect(screen.getByRole('meter', { name: 'Değerlendirme çubuğu' })).toHaveAttribute('aria-valuenow', '76'));
});

it('Ekran Ayarları "Değerlendirme" kapatılınca çubuk kaybolur', async () => {
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByRole('meter', { name: 'Değerlendirme çubuğu' }));
  fireEvent.click(screen.getByText('Değerlendirme'));
  expect(screen.queryByRole('meter', { name: 'Değerlendirme çubuğu' })).not.toBeInTheDocument();
});

it('madde 2026-09-17 (madde 8): Notasyon kapatılınca ChessBoard\'a hideNotation=true geçer', async () => {
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByTestId('chess-board'));
  expect(chessBoardMocks.lastProps?.hideNotation).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Notasyon' }));
  await waitFor(() => expect(chessBoardMocks.lastProps?.hideNotation).toBe(true));
});

it('madde 2026-09-17 (madde 5a): Analiz Tahtası\'nda ChessBoard\'a onArrowsChange/onMarksChange geçer', async () => {
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByTestId('chess-board'));
  expect(chessBoardMocks.lastProps?.onArrowsChange).toBe(roomActions.sendArrows);
  expect(chessBoardMocks.lastProps?.onMarksChange).toBe(roomActions.sendMarks);
});

it('madde 2026-09-17 (madde 5): "Konum Tahtası"nda BoardEditor\'a onArrowsChange/onMarksChange geçer', async () => {
  render(<DerslerCanliHostPage />);
  await waitFor(() => screen.getByTestId('chess-board'));
  fireEvent.click(screen.getByText('Konum Tahtası'));
  expect(boardEditorMocks.lastProps?.onArrowsChange).toBe(roomActions.sendArrows);
  expect(boardEditorMocks.lastProps?.onMarksChange).toBe(roomActions.sendMarks);
});

describe('madde 2026-09-17 (madde 4): Anlatım Ortamları birbirinden bağımsız', () => {
  it('Analiz\'den Konum\'a geçince resetBoard START_FEN ile çağrılır', async () => {
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByTestId('chess-board'));
    fireEvent.click(screen.getByText('Konum Tahtası'));
    expect(roomActions.resetBoard).toHaveBeenCalledWith(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
  });

  it('Anlatım\'a geçince resetBoard EMPTY_FEN ile çağrılır', async () => {
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByTestId('chess-board'));
    fireEvent.click(screen.getByText('Anlatım Tahtası'));
    expect(roomActions.resetBoard).toHaveBeenCalledWith('8/8/8/8/8/8/8/8 w - - 0 1');
    await waitFor(() => screen.getByTestId('accordion'));
  });

  it('aynı moda tekrar basınca resetBoard TEKRAR çağrılmaz', async () => {
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByTestId('chess-board'));
    roomActions.resetBoard.mockClear();
    fireEvent.click(screen.getByText('Analiz Tahtası'));
    expect(roomActions.resetBoard).not.toHaveBeenCalled();
  });

  it('Anlatım\'dan çıkıp tekrar girince önceki Alt Konu seçimi sıfırlanır', async () => {
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByTestId('chess-board'));
    fireEvent.click(screen.getByText('Anlatım Tahtası'));
    await waitFor(() => screen.getByTestId('accordion'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    expect(screen.getByTestId('alt-konu-walkthrough')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Analiz Tahtası'));
    fireEvent.click(screen.getByText('Anlatım Tahtası'));
    await waitFor(() => screen.getByTestId('accordion'));
    expect(screen.queryByTestId('alt-konu-walkthrough')).not.toBeInTheDocument();
  });
});

describe('madde 2026-09-17 (madde 9): antrenörün kendi mikrofonu', () => {
  it('mikrofon ikonu tıklanınca setMicrophoneEnabled çağrılır', async () => {
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByText('Açılış Dersi'));
    fireEvent.click(screen.getByTitle('Mikrofonumu kapat'));
    expect(localParticipantMocks.setMicrophoneEnabled).toHaveBeenCalledWith(false);
  });
});

describe('madde 2026-09-17 (madde 6): LiveKit kotası (tahmini)', () => {
  it('tahmin geldiğinde kart gösterilir', async () => {
    mocks.fetchLiveLessonUsageEstimate.mockResolvedValue({ estimated_minutes: 120, free_tier_minutes: 5000 });
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByText(/120 dk \/ 5000 dk/));
  });

  it('tahmin gelmezse kart hiç gösterilmez', async () => {
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByTestId('chess-board'));
    expect(screen.queryByText('LiveKit Kotası (tahmini)')).not.toBeInTheDocument();
  });
});

describe('madde 2026-09-18 (madde 3): "LiveKit Kotası" Ekran Ayarları düğmesi', () => {
  it('düğmeye tıklayınca kota kartı gizlenir, tekrar tıklayınca geri gelir', async () => {
    mocks.fetchLiveLessonUsageEstimate.mockResolvedValue({ estimated_minutes: 120, free_tier_minutes: 5000 });
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByText(/120 dk \/ 5000 dk/));

    fireEvent.click(screen.getByRole('button', { name: 'LiveKit Kotası' }));
    expect(screen.queryByText(/120 dk \/ 5000 dk/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'LiveKit Kotası' }));
    await waitFor(() => screen.getByText(/120 dk \/ 5000 dk/));
  });
});

describe('madde 2026-09-18 (madde 4): kota sayısı periyodik güncellenir', () => {
  it('60 saniyede bir fetchLiveLessonUsageEstimate tekrar çağrılır', async () => {
    vi.useFakeTimers();
    try {
      mocks.fetchLiveLessonUsageEstimate.mockResolvedValue({ estimated_minutes: 120, free_tier_minutes: 5000 });
      render(<DerslerCanliHostPage />);
      await vi.waitFor(() => expect(mocks.fetchLiveLessonUsageEstimate).toHaveBeenCalledTimes(1));

      mocks.fetchLiveLessonUsageEstimate.mockResolvedValue({ estimated_minutes: 145, free_tier_minutes: 5000 });
      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
      });
      await vi.waitFor(() => expect(screen.getByText(/145 dk \/ 5000 dk/)).toBeInTheDocument());
      expect(mocks.fetchLiveLessonUsageEstimate).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('madde 2026-09-18 (düzeltme turu): Katılımcılar kartı 2. sütuna (Ekran Ayarları altına) taşındı', () => {
  it('Katılımcılar, Ekran Ayarları ile AYNI sütunda ve ondan hemen sonra görünür', async () => {
    mocks.fetchLiveLessonUsageEstimate.mockResolvedValue({ estimated_minutes: 120, free_tier_minutes: 5000 });
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByText(/120 dk \/ 5000 dk/));

    const ekranAyarlariEl = screen.getByText('Ekran Ayarları');
    const katilimcilarEl = screen.getByText(/Katılımcılar \(/);
    const sohbetEl = screen.getByText('Sohbet');
    // DOM sırası: Ekran Ayarları önce (2. sütun), Katılımcılar sonra (AYNI sütun), Sohbet en son (3. sütun).
    expect(ekranAyarlariEl.compareDocumentPosition(katilimcilarEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(katilimcilarEl.compareDocumentPosition(sohbetEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const column2 = ekranAyarlariEl.closest<HTMLElement>('div.space-y-4');
    expect(column2).toContainElement(katilimcilarEl);
  });
});

describe('madde 2026-09-18 (madde 2): Notasyon kartı tahtayla hizalı', () => {
  it('sütun 1 konteyneri maxWidth: 720 stiline sahip', async () => {
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByTestId('chess-board'));
    const notasyonHeading = screen.getByText('Notasyon', { selector: 'p.mb-2' });
    const column = notasyonHeading.closest<HTMLElement>('div.space-y-4');
    expect(column).toHaveStyle({ maxWidth: '720px' });
  });
});

describe('madde 2026-09-16 (Antrenör Ekranı, Faz C): "Anlatım Tahtası"', () => {
  it('moda geçince Çalışmalar sekmesi çekilir, Düzey/Konu ağacı (accordion) görünür', async () => {
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByTestId('chess-board'));

    fireEvent.click(screen.getByText('Anlatım Tahtası'));
    await waitFor(() => expect(customTabsMocks.listCustomTabs).toHaveBeenCalled());
    await waitFor(() => screen.getByTestId('accordion'));
    // Bu modda ana tahta salt-okunur olarak KALIR (adım geçişleri onu günceller).
    expect(screen.getByTestId('chess-board')).toBeInTheDocument();
    expect(screen.queryByTestId('board-editor')).not.toBeInTheDocument();
    // Madde 2026-09-17 (madde 5a): Anlatım Tahtası'nda da ok/işaret yayını çalışır.
    expect(chessBoardMocks.lastProps?.onArrowsChange).toBe(roomActions.sendArrows);
    expect(chessBoardMocks.lastProps?.onMarksChange).toBe(roomActions.sendMarks);
  });

  it('Çalışmalar sekmesi bulunamazsa uyarı gösterir', async () => {
    customTabsMocks.listCustomTabs.mockResolvedValue([]);
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByTestId('chess-board'));
    fireEvent.click(screen.getByText('Anlatım Tahtası'));
    await waitFor(() => screen.getByText('Çalışmalar sekmesi bulunamadı.'));
  });

  it('Alt Konu seçilince AltKonuWalkthrough görünür (accordion kaybolur); adım değişince resetBoard çağrılır; "Geri" ile listeye dönülür', async () => {
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByTestId('chess-board'));
    fireEvent.click(screen.getByText('Anlatım Tahtası'));
    await waitFor(() => screen.getByTestId('accordion'));

    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
    expect(screen.queryByTestId('accordion')).not.toBeInTheDocument();
    expect(screen.getByTestId('alt-konu-walkthrough')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Adım Değiştir'));
    expect(roomActions.resetBoard).toHaveBeenCalledWith('STEP_FEN');

    fireEvent.click(screen.getByText('← Konu listesine dön'));
    expect(screen.getByTestId('accordion')).toBeInTheDocument();
    expect(screen.queryByTestId('alt-konu-walkthrough')).not.toBeInTheDocument();
  });

  it('"Ödev Gönder" tetiklenince gömülü panel açılır (sectionId doğru), "Kapat" ile kapanır', async () => {
    render(<DerslerCanliHostPage />);
    await waitFor(() => screen.getByTestId('chess-board'));
    fireEvent.click(screen.getByText('Anlatım Tahtası'));
    await waitFor(() => screen.getByTestId('accordion'));
    fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));

    expect(screen.queryByTestId('odev-gonder-inner')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Ödev Gönder'));
    expect(screen.getByText('Ödev Gönder Paneli #203')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Kapat'));
    expect(screen.queryByTestId('odev-gonder-inner')).not.toBeInTheDocument();
  });
});
