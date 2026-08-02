# Maç Ekranı Yatay/Dikey Tasarım Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maç ekranını (bota karşı + insana karşı) kullanıcının verdiği görsellere
göre yeniden düzenlemek — avatar/isim/süre tahtanın üstünde/altında, cihaz
dikey↔yatay döndüğünde ekran otomatik değişsin. Bota karşı maçlarda "Yeniden
Oyna" gerçekten çalışsın.

**Architecture:** Tek bir `MatchLayout` bileşeni (yeni) hem `LiveGame.tsx` hem
`BotGame.tsx` tarafından kullanılır. **Kritik tasarım kararı:** dikey ve yatay
için AYRI iki JSX bloğu YAZILMAZ — bu, "Terk Et" gibi butonları DOM'da İKİ KEZ
oluştururdu (mevcut testler `getByRole`/`getByText` ile TEK eşleşme bekliyor,
kırılırdı). Bunun yerine TEK bir DOM ağacı, CSS Grid `grid-template-areas` ile
kurulur; `@media (orientation: landscape)` kuralı (yeni, `app/globals.css`)
aynı öğeleri farklı hücrelere taşır — hiçbir öğe ikinci kez render edilmez.

**Tech Stack:** React/Next.js, CSS Grid (yeni `.match-grid` sınıfı,
`app/globals.css`), vitest + testing-library, FastAPI/pytest.

**İlgili belge:** `docs/superpowers/specs/2026-08-02-mac-ekrani-yatay-dikey-tasarim-design.md`

**Kapsam dışı (bilerek):** İnsana karşı maçlarda rematch; `BotGameLive.tsx`'e
dokunmak (henüz hiçbir sayfaya bağlı değil, `LiveGame.tsx` üzerinden düzeni
otomatik miras alacak); `MatchHeader.tsx`'in SİLİNMESİ (kullanımdan kalkar ama
bu planda silinmez — ayrı bir temizlik görevi olarak işaretlenecek).

---

### Task 1: Backend — `game_info`'ya avatar alanları

**Kök neden:** Avatar sistemi zaten var (`ChildProfile.avatar`,
`apps/web/lib/avatars.ts`), ama maç ekranında hiç kullanılmıyor çünkü
`game_info` mesajı avatarı hiç göndermiyor.

**Files:**
- Modify: `apps/api/chess_api/routers/live_game.py:191-209` (`game_ws` içindeki `game_info` bloğu)
- Test: `apps/api/tests/test_bot_game_info_name.py` (genişletilecek)

- [ ] **Step 1: Başarısız testleri yaz**

`apps/api/tests/test_bot_game_info_name.py` dosyasının SONUNA ekle:

```python
@pytest.mark.asyncio
async def test_bot_macinda_bos_kalan_taraf_robot_avatari_alir(env):
    async with env() as db:
        game = Game(type=GameType.bot, status=GameStatus.active, white_child_id=9,
                    black_bot_level=5, student_color="w")
        db.add(game)
        await db.commit()
        await db.refresh(game)
        gid = game.id

    token = encode_token({"child_profile_id": 9, "role": "child"})
    client = TestClient(create_app())
    with client.websocket_connect(f"/ws/game/{gid}?token={token}") as ws:
        msg = ws.receive_json()
        while msg["type"] != "game_info":
            msg = ws.receive_json()

    assert msg["black_avatar"] == "robot"


@pytest.mark.asyncio
async def test_insan_macinda_gercek_avatar_gonderilir(env):
    from chess_api.routers.live_game import _create_human_game
    from chess_api.models import ChildProfile

    async with env() as db:
        db.add(ChildProfile(id=1, parent_user_id=1, display_name="Zafer", age=10,
                             avatar="knight", pin_hash="x"))
        await db.commit()
    gid = await _create_human_game(1, 2)

    token = encode_token({"child_profile_id": 1, "role": "child"})
    client = TestClient(create_app())
    with client.websocket_connect(f"/ws/game/{gid}?token={token}") as ws:
        msg = ws.receive_json()
        while msg["type"] != "game_info":
            msg = ws.receive_json()

    assert msg["white_avatar"] == "knight"
    # black_child_id=2 icin ChildProfile hic olusturulmadi -> varsayilan.
    assert msg["black_avatar"] == "default"
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_game_info_name.py -v -k avatar`
Expected: FAIL — `KeyError: 'black_avatar'` (alan henüz yok).

- [ ] **Step 3: `game_info` bloğuna avatar alanlarını ekle**

`apps/api/chess_api/routers/live_game.py` içinde şu bloğu:

```python
        w = await db.get(ChildProfile, g.white_child_id) if g.white_child_id else None
        b = await db.get(ChildProfile, g.black_child_id) if g.black_child_id else None
        current_fen, _ = await _current_fen_and_ply(db, game_id)
        # Bot macinda bos kalan taraf botun kendisidir — "Sporcu" degil "Bot".
        default_name = "Bot" if g.type == GameType.bot else "Sporcu"
        # Yeniden baglanan sporcu notasyon listesini bastan gorur.
        past = (await db.execute(
            select(GameMove).where(GameMove.game_id == game_id)
            .order_by(GameMove.ply.asc())
        )).scalars().all()
        await websocket.send_json({
            "type": "game_info",
            "white_name": w.display_name if w else default_name,
            "black_name": b.display_name if b else default_name,
```

şununla değiştir:

```python
        w = await db.get(ChildProfile, g.white_child_id) if g.white_child_id else None
        b = await db.get(ChildProfile, g.black_child_id) if g.black_child_id else None
        current_fen, _ = await _current_fen_and_ply(db, game_id)
        # Bot macinda bos kalan taraf botun kendisidir — "Sporcu"/"default"
        # degil "Bot"/"robot" (bkz. lib/avatars.ts AVATARS listesindeki
        # 'robot' -> 🤖 eslemesi).
        is_bot_game = g.type == GameType.bot
        default_name = "Bot" if is_bot_game else "Sporcu"
        default_avatar = "robot" if is_bot_game else "default"
        # Yeniden baglanan sporcu notasyon listesini bastan gorur.
        past = (await db.execute(
            select(GameMove).where(GameMove.game_id == game_id)
            .order_by(GameMove.ply.asc())
        )).scalars().all()
        await websocket.send_json({
            "type": "game_info",
            "white_name": w.display_name if w else default_name,
            "black_name": b.display_name if b else default_name,
            "white_avatar": w.avatar if w else default_avatar,
            "black_avatar": b.avatar if b else default_avatar,
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_game_info_name.py -v`
Expected: PASS (4 test — mevcut 2 + yeni 2).

- [ ] **Step 5: Regresyon**

Run: `cd apps/api && python -m pytest tests/test_live_game_ws.py tests/test_game_info_moves.py tests/test_live_two_moves.py tests/test_draw_offers_ws.py tests/test_bot_move_server.py tests/test_bot_draw_ws.py -v`
Expected: TÜMÜ PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/chess_api/routers/live_game.py apps/api/tests/test_bot_game_info_name.py
git commit -m "feat: game_info white_avatar/black_avatar alanlari eklendi"
```

---

### Task 2: `MatchLayout.tsx` — tek DOM ağacı, CSS Grid ile duyarlı

**Files:**
- Create: `apps/web/components/play/MatchLayout.tsx`
- Modify: `apps/web/app/globals.css` (sona `.match-grid` bloğu eklenir)
- Test: `apps/web/tests/match-layout.test.tsx`

- [ ] **Step 1: Başarısız testleri yaz**

`apps/web/tests/match-layout.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchLayout } from '@/components/play/MatchLayout';
import type { PlayerInfo } from '@/components/play/MatchLayout';

const top: PlayerInfo = { avatarId: 'robot', name: 'Bot', ms: 60000, active: false };
const bottom: PlayerInfo = { avatarId: 'girl', name: 'Sen', ms: 60000, active: true };

function renderLayout(overrides: Partial<Parameters<typeof MatchLayout>[0]> = {}) {
  return render(
    <MatchLayout
      top={top}
      bottom={bottom}
      board={<div data-testid="board-slot" />}
      moveList={<div data-testid="movelist-slot" />}
      over={false}
      drawLabel="Beraberlik Teklif Et (3)"
      drawDisabled={false}
      onOfferDraw={vi.fn()}
      onResign={vi.fn()}
      {...overrides}
    />,
  );
}

describe('MatchLayout — tek DOM ağacı (çift render YOK)', () => {
  it('tahta ve hamle listesi yalnızca BİR KEZ render edilir', () => {
    renderLayout();
    expect(screen.getAllByTestId('board-slot')).toHaveLength(1);
    expect(screen.getAllByTestId('movelist-slot')).toHaveLength(1);
  });

  it('Terk Et butonu yalnızca BİR KEZ vardır (mevcut testlerin getByRole varsayımı)', () => {
    renderLayout();
    expect(screen.getAllByRole('button', { name: 'Terk Et' })).toHaveLength(1);
  });
});

describe('MatchLayout — Yeniden Oyna butonu', () => {
  it('onRematch verilmezse buton HİÇ render edilmez', () => {
    renderLayout();
    expect(screen.queryByRole('button', { name: 'Yeniden Oyna' })).not.toBeInTheDocument();
  });

  it('onRematch verilirse buton görünür; rematchEnabled=false ise devre dışıdır', () => {
    renderLayout({ onRematch: vi.fn(), rematchEnabled: false });
    expect(screen.getByRole('button', { name: 'Yeniden Oyna' })).toBeDisabled();
  });

  it('rematchEnabled=true ise aktiftir', () => {
    renderLayout({ onRematch: vi.fn(), rematchEnabled: true });
    expect(screen.getByRole('button', { name: 'Yeniden Oyna' })).not.toBeDisabled();
  });
});

describe('MatchLayout — maç bitince sonuç gösterilir', () => {
  it('over=true ise resultSlot görünür', () => {
    renderLayout({ over: true, resultSlot: <p>Kazandın!</p> });
    expect(screen.getByText('Kazandın!')).toBeInTheDocument();
  });

  it('over=true ise Terk Et/Beraberlik butonları DEVRE DIŞI kalır (kaldırılmaz)', () => {
    renderLayout({ over: true, resultSlot: <p>Bitti</p> });
    expect(screen.getByRole('button', { name: 'Terk Et' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Beraberlik/ })).toBeDisabled();
  });
});

describe('MatchLayout — avatar ve isim gösterimi', () => {
  it('top ve bottom oyuncu isimleri görünür', () => {
    renderLayout();
    expect(screen.getByText('Bot')).toBeInTheDocument();
    expect(screen.getByText('Sen')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/web && npx vitest run tests/match-layout.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/play/MatchLayout"`.

- [ ] **Step 3: `MatchLayout.tsx`'i yaz**

`apps/web/components/play/MatchLayout.tsx`:

```tsx
'use client';
import type { ReactNode } from 'react';
import { formatClock, isLowTime } from '@/lib/play/clockFormat';
import { avatarEmoji } from '@/lib/avatars';

export interface PlayerInfo {
  avatarId: string;
  name: string;
  /** Kalan süre (ms). null => saatsiz maç: kutu "—" gösterir. */
  ms: number | null;
  /** Sırası bu oyuncuda mı — kutu vurgulanır. */
  active: boolean;
}

interface Props {
  /** Tahtanın ÜSTÜNDE gösterilen taraf (rakip / bot). */
  top: PlayerInfo;
  /** Tahtanın ALTINDA gösterilen taraf (sporcunun kendisi). */
  bottom: PlayerInfo;
  board: ReactNode;
  moveList: ReactNode;
  /** Hamle listesinin altında, buton satırının üstünde serbest alan
   *  (bilgi mesajı, beraberlik teklifi kartı, "bot düşünüyor" vb.). */
  extra?: ReactNode;
  over: boolean;
  resultSlot?: ReactNode;
  drawLabel: string;
  drawDisabled: boolean;
  onOfferDraw: () => void;
  onResign: () => void;
  /** Verilmezse "Yeniden Oyna" butonu HİÇ render edilmez (insan-insan maçı). */
  onRematch?: () => void;
  rematchEnabled?: boolean;
}

function TimeBox({ ms, active }: { ms: number | null; active: boolean }) {
  const low = ms !== null && isLowTime(ms);
  return (
    <div
      data-active={active ? 'true' : 'false'}
      className="t-card-i flex items-center justify-center flex-shrink-0"
      style={{
        minWidth: 'clamp(3.2rem, 14vw, 4.5rem)',
        minHeight: '2.5rem',
        border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
        background: active ? 'var(--t-surface-2)' : undefined,
      }}
    >
      <span
        className="font-mono font-bold tabular-nums text-sm"
        style={{ color: low ? '#f87171' : 'var(--t-text)' }}
      >
        {ms === null ? '—' : formatClock(ms)}
      </span>
    </div>
  );
}

function PlayerBadge({ avatarId, name, active }: { avatarId: string; name: string; active: boolean }) {
  return (
    <div
      data-active={active ? 'true' : 'false'}
      className="t-card-i flex items-center gap-2 px-3 py-2 min-w-0"
      style={{ border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)' }}
    >
      <span className="text-2xl flex-shrink-0" aria-hidden="true">{avatarEmoji(avatarId)}</span>
      <span className="font-semibold text-sm truncate">{name}</span>
    </div>
  );
}

/** Maç ekranının hem dikey hem yatay kullanıma uyan yerleşimi.
 *
 *  TEK BİR DOM AĞACI kurulur — dikey/yatay için AYRI JSX bloğu YAZILMAZ.
 *  Sebep: iki blok yazılsaydı "Terk Et" gibi butonlar DOM'da İKİ KEZ
 *  oluşurdu; mevcut testler (`getByRole('button', {name:'Terk Et'})`) TEK
 *  eşleşme bekliyor ve kırılırdı. Bunun yerine `.match-grid` (app/globals.css)
 *  CSS Grid `grid-template-areas`'ı `@media (orientation: landscape)` ile
 *  DEĞİŞTİRİR — aynı öğeler farklı hücrelere taşınır, hiçbiri ikinci kez
 *  render edilmez.
 */
export function MatchLayout({
  top, bottom, board, moveList, extra, over, resultSlot,
  drawLabel, drawDisabled, onOfferDraw, onResign, onRematch, rematchEnabled,
}: Props) {
  return (
    <div className="max-w-2xl mx-auto px-4 space-y-2">
      <div className="match-grid">
        <div className="ml-avatar-top">
          <PlayerBadge avatarId={top.avatarId} name={top.name} active={top.active} />
        </div>
        <div className="ml-time-top">
          <TimeBox ms={top.ms} active={top.active} />
        </div>
        <div className="ml-board">{board}</div>
        <div className="ml-avatar-bottom">
          <PlayerBadge avatarId={bottom.avatarId} name={bottom.name} active={bottom.active} />
        </div>
        <div className="ml-time-bottom">
          <TimeBox ms={bottom.ms} active={bottom.active} />
        </div>
        <div className="ml-moves">{moveList}</div>
        <div className="ml-actions">
          <button
            type="button"
            disabled={drawDisabled || over}
            onClick={onOfferDraw}
            className="t-btn-ghost px-4 py-2 text-sm disabled:opacity-40"
          >
            {drawLabel}
          </button>
          <button
            type="button"
            disabled={over}
            onClick={() => { if (confirm('Maçı terk etmek istiyor musun? Maçı kaybedeceksin.')) onResign(); }}
            className="t-btn px-4 py-2 text-sm disabled:opacity-40"
            style={{ background: 'var(--t-err-bg, #ef4444)', color: '#fff' }}
          >
            Terk Et
          </button>
          {onRematch && (
            <button
              type="button"
              disabled={!rematchEnabled}
              onClick={onRematch}
              className="t-btn-ghost px-4 py-2 text-sm disabled:opacity-40"
            >
              Yeniden Oyna
            </button>
          )}
        </div>
      </div>
      {over && resultSlot}
      {extra}
    </div>
  );
}
```

- [ ] **Step 4: `.match-grid` CSS'ini `app/globals.css`'e ekle**

`apps/web/app/globals.css` dosyasının SONUNA ekle:

```css
/* Maç ekranı (bota/insana karşı) yerleşimi — bkz. components/play/MatchLayout.tsx.
   Dikey/yatay için AYRI JSX YOK: ayni ogeler grid-template-areas ile
   yeniden konumlanir, hicbiri ikinci kez render edilmez. */
.match-grid {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    "avatar-top time-top"
    "board board"
    "avatar-bottom time-bottom"
    "moves moves"
    "actions actions";
}
.match-grid > .ml-avatar-top    { grid-area: avatar-top; }
.match-grid > .ml-time-top      { grid-area: time-top; }
.match-grid > .ml-board         { grid-area: board; min-width: 0; }
.match-grid > .ml-avatar-bottom { grid-area: avatar-bottom; }
.match-grid > .ml-time-bottom   { grid-area: time-bottom; }
.match-grid > .ml-moves         { grid-area: moves; min-height: 0; }
.match-grid > .ml-actions {
  grid-area: actions;
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

@media (orientation: landscape) {
  .match-grid {
    grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: auto 1fr auto;
    grid-template-areas:
      "time-top    board avatar-top"
      "actions     board moves"
      "time-bottom board avatar-bottom";
    align-items: stretch;
  }
  .match-grid > .ml-board { max-width: 60vh; justify-self: center; min-width: 0; }
  .match-grid > .ml-moves { min-height: 0; overflow: hidden; }
  .match-grid > .ml-actions { flex-direction: column; justify-content: center; }
}
```

- [ ] **Step 5: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/web && npx vitest run tests/match-layout.test.tsx`
Expected: PASS (7 test).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/play/MatchLayout.tsx apps/web/app/globals.css apps/web/tests/match-layout.test.tsx
git commit -m "feat: MatchLayout - dikey/yatay duyarli mac ekrani yerlesimi"
```

---

### Task 3: `LiveGame.tsx`'i `MatchLayout`'a bağla

**Files:**
- Modify: `apps/web/components/LiveGame.tsx`
- Test: `apps/web/tests/live-game-controls.test.tsx` (regresyon, DEĞİŞTİRİLMEZ)
- Test: `apps/web/tests/live-game-match-layout.test.tsx` (yeni)

- [ ] **Step 1: Başarısız testleri yaz**

`apps/web/tests/live-game-match-layout.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

let handler: ((d: unknown) => void) | null = null;

vi.mock('@/lib/hooks/use-websocket', () => ({
  useWebSocket: (_url: string | null, onMessage: (d: unknown) => void) => {
    handler = onMessage;
    return { send: vi.fn(), readyState: 1 };
  },
  wsBase: () => 'ws://test',
}));
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import { LiveGame } from '@/components/LiveGame';

describe('LiveGame — game_info avatar bilgisi MatchLayout\'a gider', () => {
  it('white_avatar/black_avatar geldiğinde doğru emoji gösterilir', () => {
    render(<LiveGame gameId={1} myColor="white" />);
    act(() => handler!({
      type: 'game_info', white_name: 'Zafer', black_name: 'Hasan',
      white_avatar: 'knight', black_avatar: 'robot',
      white_to_move: true, moves: [], current_fen:
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      status: 'active',
    }));
    expect(screen.getByText('🤴')).toBeInTheDocument(); // knight
    expect(screen.getByText('🤖')).toBeInTheDocument(); // robot
  });

  it('LiveGame\'de onRematch VERİLMEDİĞİ için "Yeniden Oyna" hiç görünmez', () => {
    render(<LiveGame gameId={1} myColor="white" />);
    expect(screen.queryByRole('button', { name: 'Yeniden Oyna' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/web && npx vitest run tests/live-game-match-layout.test.tsx`
Expected: FAIL — `LiveGame` henüz avatar göstermiyor (MatchHeader kullanıyor).

- [ ] **Step 3: `LiveGame.tsx`'i güncelle**

Import bloğuna ekle (mevcut `MatchHeader` import satırının YERİNE):

```tsx
import { MatchLayout } from '@/components/play/MatchLayout';
import type { PlayerInfo } from '@/components/play/MatchLayout';
```

`whiteName`/`blackName` state'lerinin yanına avatar state'leri ekle (satır ~32-33
civarı, `const [whiteName, setWhiteName] = useState('Sporcu');` satırlarının
ardına):

```tsx
  const [whiteAvatar, setWhiteAvatar] = useState('default');
  const [blackAvatar, setBlackAvatar] = useState('default');
```

`game_info` mesaj işleyicisinde (mevcut `setWhiteName`/`setBlackName`
satırlarının HEMEN ALTINA) ekle:

```tsx
      setWhiteAvatar(typeof msg.white_avatar === 'string' ? msg.white_avatar : 'default');
      setBlackAvatar(typeof msg.black_avatar === 'string' ? msg.black_avatar : 'default');
```

Mesaj tipinin (`msg` union tip tanımı, dosyanın başındaki `const msg = data as {...}`
bloğu) içine `white_avatar?: string; black_avatar?: string;` alanlarını ekle
(mevcut `white_name?: string; black_name?: string;` satırlarının hemen altına).

Dosyanın return bloğunu (satır ~237-336, `MatchHeader`'dan `</div>`'e kadar
TÜMÜ) şununla değiştir:

```tsx
  const iAmWhite = myColor === 'white';
  const top: PlayerInfo = {
    avatarId: iAmWhite ? blackAvatar : whiteAvatar,
    name: iAmWhite ? blackName : whiteName,
    ms: iAmWhite ? blackMs : whiteMs,
    active: status === 'active' && (iAmWhite ? !whiteToMove : whiteToMove),
  };
  const bottom: PlayerInfo = {
    avatarId: iAmWhite ? whiteAvatar : blackAvatar,
    name: iAmWhite ? whiteName : blackName,
    ms: iAmWhite ? whiteMs : blackMs,
    active: status === 'active' && (iAmWhite ? whiteToMove : !whiteToMove),
  };
  const canOffer = canOfferDraw(myOffersUsed);

  return (
    <MatchLayout
      top={top}
      bottom={bottom}
      board={
        <>
          <ChessBoard
            fen={nav.isLive ? fen : nav.viewFen}
            interactive={status === 'active' && nav.isLive}
            onPieceDrop={handleDrop}
            boardOrientation={myColor}
            onWheelStep={nav.step}
            historyView={!nav.isLive}
            onLeaveHistory={nav.goLive}
            onPremove={choosePremove}
            premoveColor={myColor === 'white' ? 'w' : 'b'}
            premoveSquares={premove}
          />
          <HistoryBanner isLive={nav.isLive} viewIndex={nav.viewIndex} onGoLive={nav.goLive} />
        </>
      }
      moveList={
        <MoveList
          san={sanList}
          startFen={startFen}
          onSelectPly={nav.goTo}
          activePly={nav.isLive ? undefined : nav.viewIndex}
        />
      }
      extra={
        <>
          {pending && (
            <PromotionPicker
              onPick={(piece) => {
                const p = pending;
                setPending(null);
                applyMyMove(p.from, p.to, piece);
              }}
              onCancel={() => setPending(null)}
            />
          )}

          {drawOffered && status === 'active' && (
            <div className="t-ok p-3 space-y-2">
              <p className="text-sm font-semibold">Rakip beraberlik teklif etti</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { send({ type: 'accept_draw' }); setDrawOffered(false); }}
                  className="t-btn px-4 py-2 text-sm"
                >
                  Kabul Et
                </button>
                <button
                  type="button"
                  onClick={() => { send({ type: 'decline_draw' }); setDrawOffered(false); }}
                  className="t-btn-ghost px-4 py-2 text-sm"
                >
                  Kabul Etme
                </button>
              </div>
            </div>
          )}

          {info && <p className="text-center text-sm t-muted">{info}</p>}
        </>
      }
      over={status === 'over'}
      resultSlot={
        <div className="t-ok p-4 text-center space-y-1">
          {resultLine && <p className="text-lg font-bold">{resultLine}</p>}
        </div>
      }
      drawLabel={`Beraberlik Teklif Et (${offersLeft(myOffersUsed)})`}
      drawDisabled={!canOffer}
      onOfferDraw={() => send({ type: 'offer_draw' })}
      onResign={() => send({ type: 'resign' })}
    />
  );
}
```

> NOT: `LiveGame.tsx`'in ESKİ kodunda `confirm('Maçı terk etmek...')` çağrısı
> DOĞRUDAN JSX'teki `onClick`'in içindeydi. `MatchLayout`'un Terk Et butonu
> ARTIK KENDİ `confirm(...)`'ünü yapıyor (Task 2) — bu yüzden `onResign`'a
> geçirilen fonksiyon SADE `send({ type: 'resign' })` olmalı, İKİNCİ bir
> `confirm` EKLENMEMELİ (aksi halde sporcu İKİ KEZ onaylamak zorunda kalırdı).

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/web && npx vitest run tests/live-game-match-layout.test.tsx`
Expected: PASS (2 test).

- [ ] **Step 5: Regresyon — MEVCUT testler DEĞİŞMEDEN geçmeli**

Run: `cd apps/web && npx vitest run tests/live-game-controls.test.tsx`
Expected: PASS (9 test — bu dosya HİÇ değiştirilmedi; `MatchLayout`'un TEK DOM
ağacı kararı sayesinde `getByRole` tek-eşleşme varsayımları bozulmamalı).

- [ ] **Step 6: `tsc` kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Hatasız (özellikle `msg` tipine eklenen `white_avatar`/`black_avatar`
alanları doğru tanımlı olmalı).

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/LiveGame.tsx apps/web/tests/live-game-match-layout.test.tsx
git commit -m "feat: LiveGame MatchLayout kullaniyor, avatar gosteriliyor"
```

---

### Task 4: `BotGame.tsx`'i `MatchLayout`'a bağla + Yeniden Oyna

**Files:**
- Modify: `apps/web/components/BotGame.tsx`
- Modify: `apps/web/app/(child)/play/page.tsx`
- Modify: `apps/web/components/play/OpeningPractice.tsx`
- Test: `apps/web/tests/bot-game-persistence.test.tsx`, `bot-game-premove.test.tsx`, `bot-game-history.test.tsx`, `bot-game-color.test.tsx` (regresyon, DEĞİŞTİRİLMEZ)
- Test: `apps/web/tests/bot-game-match-layout.test.tsx` (yeni)

- [ ] **Step 1: Başarısız testleri yaz**

`apps/web/tests/bot-game-match-layout.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-testid="board" data-fen={fen} />,
}));
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return '(none)'; }
    destroy() {}
  },
}));
vi.mock('@/lib/auth-storage', () => ({
  getToken: () => 'tok',
  getAthleteName: () => 'Ahmet',
}));
vi.mock('@/lib/avatars', async () => {
  const actual = await vi.importActual<typeof import('@/lib/avatars')>('@/lib/avatars');
  return { ...actual, getSavedAvatar: () => 'unicorn' };
});

import { BotGame } from '@/components/BotGame';

describe('BotGame — Yeniden Oyna', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ game_id: 1 }),
    }));
  });

  it('onRematch verilmezse buton görünmez', async () => {
    render(<BotGame skillLevel={5} depth={5} onGameEnd={vi.fn()} />);
    await screen.findByTestId('board');
    expect(screen.queryByRole('button', { name: 'Yeniden Oyna' })).not.toBeInTheDocument();
  });

  it('onRematch verilirse buton görünür ama maç sürerken DEVRE DIŞIDIR', async () => {
    render(<BotGame skillLevel={5} depth={5} onGameEnd={vi.fn()} onRematch={vi.fn()} />);
    await screen.findByTestId('board');
    expect(screen.getByRole('button', { name: 'Yeniden Oyna' })).toBeDisabled();
  });

  it('sporcunun avatarı yerel getSavedAvatar\'dan gelir', async () => {
    render(<BotGame skillLevel={5} depth={5} onGameEnd={vi.fn()} />);
    await screen.findByTestId('board');
    expect(screen.getByText('🦄')).toBeInTheDocument(); // unicorn
    expect(screen.getByText('🤖')).toBeInTheDocument(); // bot
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/web && npx vitest run tests/bot-game-match-layout.test.tsx`
Expected: FAIL — `BotGame`'in `Props` tipinde `onRematch` yok, avatar hiç
gösterilmiyor.

- [ ] **Step 3: `BotGame.tsx`'i güncelle**

Import bloğuna ekle (mevcut importların arasına):

```tsx
import { MatchLayout } from '@/components/play/MatchLayout';
import type { PlayerInfo } from '@/components/play/MatchLayout';
import { getSavedAvatar } from '@/lib/avatars';
```

`MatchHeader` import satırını SİL.

`Props` arayüzüne ekle (`onGameEnd` satırının hemen altına):

```tsx
  /** Verilirse maç bitince "Yeniden Oyna" butonu görünür ve aktif olur. */
  onRematch?: () => void;
```

Fonksiyon imzasını güncelle:

```tsx
export function BotGame({ skillLevel, depth, timeControl, studentColor = 'w', startFen, onGameEnd, onRematch }: Props) {
```

`studentName` state'inin ALTINA ekle:

```tsx
  const [studentAvatar] = useState(() => getSavedAvatar());
```

Return bloğunu (satır ~333-418, `<div className="max-w-2xl ...">`'dan sona
kadar TÜMÜ, `if (status === 'loading')` bloğu HARİÇ — o KALIR) şununla
değiştir:

```tsx
  const studentTimeSec = studentColor === 'w' ? whiteTime : blackTime;
  const botTimeSec = botColor === 'w' ? whiteTime : blackTime;
  const top: PlayerInfo = {
    avatarId: 'robot',
    name: 'Bot',
    ms: tc ? botTimeSec * 1000 : null,
    active: status === 'playing' && chessRef.current.turn() === botColor,
  };
  const bottom: PlayerInfo = {
    avatarId: studentAvatar,
    name: studentName,
    ms: tc ? studentTimeSec * 1000 : null,
    active: status === 'playing' && chessRef.current.turn() === studentColor,
  };

  return (
    <MatchLayout
      top={top}
      bottom={bottom}
      board={
        <>
          <div className="h-7 flex items-center justify-center mb-2">
            {thinking && (
              <p className="t-muted text-center text-sm animate-pulse">
                🤖 Bot düşünüyor...
              </p>
            )}
          </div>
          <ChessBoard
            fen={nav.viewFen}
            interactive={status === 'playing' && !thinking && nav.isLive}
            onPieceDrop={handleDrop}
            boardOrientation={studentColor === 'w' ? 'white' : 'black'}
            onWheelStep={nav.step}
            historyView={!nav.isLive}
            onLeaveHistory={nav.goLive}
            onPremove={choosePremove}
            premoveColor={studentColor}
            premoveSquares={premove}
          />
          <HistoryBanner isLive={nav.isLive} viewIndex={nav.viewIndex} onGoLive={nav.goLive} />
        </>
      }
      moveList={
        <MoveList
          san={sanHistory}
          startFen={startFen}
          onSelectPly={nav.goTo}
          activePly={nav.isLive ? undefined : nav.viewIndex}
        />
      }
      extra={
        <>
          {pending && (
            <PromotionPicker
              onPick={(piece) => {
                const p = pending;
                setPending(null);
                applyStudentMove(p.from, p.to, piece);
              }}
              onCancel={() => setPending(null)}
            />
          )}
          {drawNote && status !== 'over' && <p className="text-center text-sm t-muted">{drawNote}</p>}
        </>
      }
      over={status === 'over'}
      resultSlot={
        <div className="t-ok p-4 text-center text-lg font-bold">
          {resultText}
        </div>
      }
      drawLabel={`Beraberlik Teklif Et (${offersLeft(drawOffersUsed)})`}
      drawDisabled={!canOfferDraw(drawOffersUsed)}
      onOfferDraw={offerDrawToBot}
      onResign={resignToBot}
      onRematch={onRematch}
      rematchEnabled={status === 'over'}
    />
  );
}
```

> NOT: `handleDrop`, `resignToBot`, `offerDrawToBot`, `applyStudentMove`
> fonksiyonları HİÇ değişmedi — yalnızca JSX'in NASIL göründüğü değişti.
> `resignToBot`'un içindeki `confirm(...)` çağrısı ARTIK GEREKSİZ çünkü
> `MatchLayout`'un Terk Et butonu zaten kendi `confirm`'ünü yapıyor — ama
> `resignToBot` bugün zaten `confirm` İÇERMİYOR (o çağrı eskiden JSX'teki
> `onClick`'teydi, `resignToBot`'un KENDİSİ değil) — bu yüzden `onResign={resignToBot}`
> DOĞRUDAN doğrudur, ek değişiklik gerekmez.

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/web && npx vitest run tests/bot-game-match-layout.test.tsx`
Expected: PASS (3 test).

- [ ] **Step 5: Regresyon — MEVCUT testler DEĞİŞMEDEN geçmeli**

Run: `cd apps/web && npx vitest run tests/bot-game-persistence.test.tsx tests/bot-game-premove.test.tsx tests/bot-game-history.test.tsx tests/bot-game-color.test.tsx`
Expected: TÜMÜ PASS.

- [ ] **Step 6: `play/page.tsx`'e rematch bağla**

`apps/web/app/(child)/play/page.tsx` içinde, `<BotGame ... />` çağrısına
(satır ~203-210) `onRematch` ekle:

```tsx
      <BotGame
        key={gameKey}
        skillLevel={botCriteria.level.skill}
        depth={botCriteria.level.depth}
        timeControl={botCriteria.timeControl}
        studentColor={botColor}
        onGameEnd={() => {}}
        onRematch={() => { setBotColor(resolveColor(botCriteria.colorChoice)); setGameKey((k) => k + 1); }}
      />
```

Sayfanın altındaki AYRI "Yeni Oyun" butonunu (satır ~212-217) SİL:

```tsx
      <div className="text-center mt-4">
        <button onClick={() => { setBotColor(resolveColor(botCriteria.colorChoice)); setGameKey((k) => k + 1); }}
          className="t-btn-ghost px-5 py-2">
          Yeni Oyun
        </button>
      </div>
```

- [ ] **Step 7: `OpeningPractice.tsx`'e rematch bağla**

`apps/web/components/play/OpeningPractice.tsx` içinde, `useState` importlarının
yanına (satır ~26 civarı, `const [color, setColor] = useState<PieceColor>('w');`
satırının ALTINA) ekle:

```tsx
  const [matchKey, setMatchKey] = useState(0);
```

`<BotGame ... />` çağrısını (satır ~64-73) güncelle:

```tsx
  if (criteria && chosen) {
    return (
      <BotGame
        key={matchKey}
        skillLevel={criteria.level.skill}
        depth={criteria.level.depth}
        timeControl={criteria.timeControl}
        studentColor={color}
        startFen={chosen.start_fen}
        onGameEnd={() => {}}
        onRematch={() => setMatchKey((k) => k + 1)}
      />
    );
  }
```

- [ ] **Step 8: Test kapısı — `tsc`/`lint`**

Run: `cd apps/web && npx tsc --noEmit && npx next lint`
Expected: Hatasız.

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/BotGame.tsx apps/web/app/\(child\)/play/page.tsx apps/web/components/play/OpeningPractice.tsx apps/web/tests/bot-game-match-layout.test.tsx
git commit -m "feat: BotGame MatchLayout kullaniyor, Yeniden Oyna calisir"
```

---

### Task 5: Tam test kapısı ve gerçek döndürme doğrulaması

**Files:** (yok — yalnızca doğrulama)

- [ ] **Step 1: Backend tam paketi**

Run: `cd apps/api && python -m pytest -q`
Expected: TÜM testler PASS (mevcut 387 + bu planın eklediği 2 = 389).

- [ ] **Step 2: Frontend tam paketi**

Run: `cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run`
Expected: `tsc`/`lint` hatasız; `vitest` mevcut testler + bu planın eklediği
(7 + 2 + 3 = 12) = TÜMÜ PASS.

- [ ] **Step 3: Gerçek tarayıcıda döndürme doğrulaması (KURAL #6)**

`BotGame.tsx` hâlâ CANLI ekran (asıl kullanılan) — Browser aracıyla:
1. `preview_start` ile `chess-web` sunucusunu aç.
2. `/play` sayfasına git, bota karşı bir maç başlat (skip login gerekiyorsa
   `sessionStorage`'a sahte token/isim yazarak, önceki oturumlarda kullanılan
   yöntemle).
3. `resize_window` ile ÖNCE dikey (`375x812`), SONRA yatay (`812x375`)
   boyuta geç.
4. Her ikisinde de `computer {action: "screenshot"}` ile GERÇEKTEN görüp,
   avatar/isim/süre/butonların görsellerdeki gibi konumlandığını doğrula.
5. Yatay boyuttayken bir hamle yap, tahtanın ve saatlerin doğru güncellendiğini
   doğrula.

Bulunan bir sorun varsa kaynak koda dönüp düzelt, bu adımı TEKRARLA.

- [ ] **Step 4: Kullanıcıya rapor + canlıya gönderme kararı**

Bu adımda kod yazılmaz. KURAL #0'a uygun sade Türkçe ile özetlenir: kaç test
geçti, gerçek tarayıcıda ne görüldü (ekran görüntüsüyle), `git push origin
main` için açık onay istenir.

- [ ] **Step 5: Kullanılmayan `MatchHeader.tsx`'i işaretle**

`MatchHeader.tsx` artık `LiveGame.tsx`/`BotGame.tsx` tarafından
KULLANILMIYOR ama bu planda SİLİNMEDİ (blast radius'u küçük tutmak için).
`mcp__ccd_session__spawn_task` ile "MatchHeader.tsx ve match-header.test.tsx
artık kullanılmıyor, silinsin" başlıklı bir temizlik görevi işaretlenir —
kullanıcı isterse ayrı bir oturumda ele alınır.
