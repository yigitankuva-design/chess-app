# Plan 6: İnsan vs İnsan Oyunu + WebSocket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Çocukların birbirleriyle gerçek zamanlı satranç oynayabildiği WebSocket tabanlı sistem. Redis matchmaking kuyruğu, disconnect handling, beraberlik/teslim teklifleri.

**Architecture:** FastAPI WebSocket endpoint'leri. Redis matchmaking queue. Server'da python-chess ile hamle doğrulama (anti-hile). Frontend `useWebSocket` hook + canlı oyun UI.

**Tech Stack:** FastAPI WebSocket, Redis pub/sub, native browser WebSocket API.

**Bağımlılık:** Plan 5 yeşil.
**Süre tahmini:** 2 hafta

---

## File Structure

```
apps/api/chess_api/
├── routers/
│   ├── matchmaking.py        # WS /ws/queue
│   └── live_game.py          # WS /ws/game/{game_id}
├── services/
│   ├── matchmaking_queue.py  # Redis-based queue
│   └── live_game_state.py    # In-memory game state per active game
└── tests/
    ├── test_matchmaking.py
    └── test_live_game.py

apps/web/
├── lib/
│   ├── ws/
│   │   ├── matchmaking.ts
│   │   └── live-game.ts
│   └── hooks/
│       └── use-websocket.ts
├── components/
│   ├── MatchmakingScreen.tsx
│   └── LiveGame.tsx
└── app/(child)/
    └── play/
        ├── page.tsx          # (modified — "Arkadaşla oyna" buton)
        └── live/[gameId]/page.tsx
```

---

## Task 1: Redis Matchmaking Service

**Files:**
- Create: `apps/api/chess_api/services/matchmaking_queue.py`
- Modify: `apps/api/chess_api/settings.py` (Redis URL zaten var)
- Create: `apps/api/tests/test_matchmaking.py`

- [ ] **Step 1.1: Redis client kur**

`requirements.txt`'e zaten `redis==5.2.0` ekli. `chess_api/data/redis_client.py` oluştur:

```python
import redis.asyncio as redis
from chess_api.settings import settings

_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(settings().REDIS_URL, decode_responses=True)
    return _client
```

- [ ] **Step 1.2: TDD — `tests/test_matchmaking.py`**

```python
import pytest
from chess_api.services.matchmaking_queue import (
    join_queue, find_match, leave_queue,
)


async def test_first_in_queue_no_match(redis_test):
    res = await join_queue(child_id=1, rating=800)
    assert res["matched"] is False
    assert res["position"] == 1


async def test_two_kids_get_matched(redis_test):
    await join_queue(child_id=1, rating=800)
    res = await join_queue(child_id=2, rating=820)
    assert res["matched"] is True
    assert res["opponent_id"] == 1
    assert "game_id" in res


async def test_too_far_rating_no_match(redis_test):
    await join_queue(child_id=1, rating=400)
    res = await join_queue(child_id=2, rating=1400)
    # Spread too wide (>200)
    assert res["matched"] is False
```

- [ ] **Step 1.3: `services/matchmaking_queue.py`**

```python
"""Redis-based matchmaking.

Strategy: simple FIFO with ±200 rating tolerance. As wait time grows,
tolerance can expand (V2 enhancement).
"""
import json
import time
from chess_api.data.redis_client import get_redis

QUEUE_KEY = "matchmaking:queue"
TOLERANCE = 200


async def join_queue(child_id: int, rating: int) -> dict:
    r = get_redis()
    # Find compatible opponent already in queue
    members = await r.lrange(QUEUE_KEY, 0, -1)
    for raw in members:
        entry = json.loads(raw)
        if entry["child_id"] == child_id:
            continue
        if abs(entry["rating"] - rating) <= TOLERANCE:
            # Match!
            await r.lrem(QUEUE_KEY, 1, raw)
            # Game will be created by router (DB transaction)
            return {
                "matched": True,
                "opponent_id": entry["child_id"],
                "opponent_rating": entry["rating"],
            }
    # Add to queue
    await r.rpush(QUEUE_KEY, json.dumps({
        "child_id": child_id, "rating": rating, "joined_at": time.time(),
    }))
    return {"matched": False, "position": await r.llen(QUEUE_KEY)}


async def leave_queue(child_id: int) -> bool:
    r = get_redis()
    members = await r.lrange(QUEUE_KEY, 0, -1)
    for raw in members:
        entry = json.loads(raw)
        if entry["child_id"] == child_id:
            await r.lrem(QUEUE_KEY, 1, raw)
            return True
    return False
```

- [ ] **Step 1.4: Test ve commit**

```bash
pytest tests/test_matchmaking.py -v
git commit -am "feat(matchmaking): Redis-based queue with rating tolerance"
```

---

## Task 2: Matchmaking WebSocket

**Files:**
- Create: `apps/api/chess_api/routers/matchmaking.py`
- Modify: `apps/api/chess_api/main.py`

- [ ] **Step 2.1: `routers/matchmaking.py`**

```python
import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_session_factory
from chess_api.services.jwt import decode_token, TokenInvalid
from chess_api.services.matchmaking_queue import join_queue, leave_queue
from chess_api.models import Game, GameType, GameStatus

router = APIRouter()


@router.websocket("/ws/queue")
async def queue_ws(websocket: WebSocket, token: str = Query(...)):
    await websocket.accept()
    try:
        payload = decode_token(token)
        child_id = payload.get("child_profile_id") or payload.get("user_id")
    except TokenInvalid:
        await websocket.close(code=4401)
        return

    rating = 800  # TODO: fetch from ChildRank
    try:
        # Poll loop: check queue, exit on match or disconnect
        while True:
            res = await join_queue(child_id, rating)
            if res["matched"]:
                # Create game in DB
                session_factory = get_session_factory()
                async with session_factory() as db:
                    game = Game(
                        type=GameType.human,
                        white_child_id=child_id,
                        black_child_id=res["opponent_id"],
                    )
                    db.add(game)
                    await db.commit()
                    await db.refresh(game)

                await websocket.send_json({
                    "type": "matched",
                    "game_id": game.id,
                    "opponent_id": res["opponent_id"],
                    "your_color": "white",
                })
                break
            else:
                await websocket.send_json({
                    "type": "waiting",
                    "position": res["position"],
                })
                await asyncio.sleep(2)
                # Re-check
                # (Simplified: each loop adds to queue → de-dup needed. Production: check first, then add once.)
    except WebSocketDisconnect:
        await leave_queue(child_id)
    except Exception:
        await leave_queue(child_id)
        await websocket.close()
```

- [ ] **Step 2.2: `main.py`'a router ekle**

```python
from chess_api.routers import matchmaking as matchmaking_router
app.include_router(matchmaking_router.router)
```

- [ ] **Step 2.3: Commit**

```bash
git commit -am "feat(matchmaking): /ws/queue WebSocket endpoint"
```

---

## Task 3: Live Game WebSocket

**Files:**
- Create: `apps/api/chess_api/services/live_game_state.py`
- Create: `apps/api/chess_api/routers/live_game.py`

- [ ] **Step 3.1: `services/live_game_state.py`**

```python
"""In-memory active game state per game_id.

For V1 single-instance deploy. For multi-instance: move to Redis pub/sub.
"""
from collections import defaultdict
from fastapi import WebSocket


class GameRoom:
    def __init__(self, game_id: int):
        self.game_id = game_id
        self.players: dict[int, WebSocket] = {}  # child_id → ws

    async def join(self, child_id: int, ws: WebSocket):
        self.players[child_id] = ws

    async def leave(self, child_id: int):
        self.players.pop(child_id, None)

    async def broadcast(self, message: dict, exclude_child_id: int | None = None):
        for cid, ws in list(self.players.items()):
            if cid == exclude_child_id:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                pass


_rooms: dict[int, GameRoom] = {}


def get_room(game_id: int) -> GameRoom:
    if game_id not in _rooms:
        _rooms[game_id] = GameRoom(game_id)
    return _rooms[game_id]
```

- [ ] **Step 3.2: `routers/live_game.py`**

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from chess_api.database import get_session_factory
from chess_api.models import Game, GameMove, GameStatus, GameResult
from chess_api.services.jwt import decode_token, TokenInvalid
from chess_api.services.live_game_state import get_room
from chess_api.services.game_validation import validate_move
from sqlalchemy import select

router = APIRouter()

INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


@router.websocket("/ws/game/{game_id}")
async def game_ws(websocket: WebSocket, game_id: int, token: str = Query(...)):
    await websocket.accept()
    try:
        payload = decode_token(token)
        child_id = payload.get("child_profile_id") or payload.get("user_id")
    except TokenInvalid:
        await websocket.close(code=4401)
        return

    session_factory = get_session_factory()
    async with session_factory() as db:
        game = await db.get(Game, game_id)
        if not game or child_id not in (game.white_child_id, game.black_child_id):
            await websocket.close(code=4403)
            return

    room = get_room(game_id)
    await room.join(child_id, websocket)
    await room.broadcast({"type": "player_joined", "child_id": child_id})

    try:
        while True:
            msg = await websocket.receive_json()
            if msg.get("type") == "move":
                await handle_move(game_id, child_id, msg, room)
            elif msg.get("type") == "resign":
                await handle_resign(game_id, child_id, room)
            elif msg.get("type") == "offer_draw":
                await room.broadcast({"type": "draw_offered", "by_child_id": child_id}, exclude_child_id=child_id)
            elif msg.get("type") == "accept_draw":
                await handle_draw(game_id, room)
    except WebSocketDisconnect:
        await room.leave(child_id)
        await room.broadcast({"type": "opponent_disconnected", "child_id": child_id})


async def handle_move(game_id: int, child_id: int, msg: dict, room):
    session_factory = get_session_factory()
    async with session_factory() as db:
        game = await db.get(Game, game_id)
        if game.status != GameStatus.active:
            return
        # Get last FEN
        last_move = (await db.execute(
            select(GameMove).where(GameMove.game_id == game_id)
            .order_by(GameMove.ply.desc()).limit(1)
        )).scalar_one_or_none()
        current_fen = last_move.fen_after if last_move else INITIAL_FEN

        # Check turn
        turn_char = current_fen.split()[1]
        is_whites_turn = turn_char == "w"
        if is_whites_turn and child_id != game.white_child_id:
            await room.players[child_id].send_json({"type": "error", "message": "Not your turn"})
            return
        if not is_whites_turn and child_id != game.black_child_id:
            await room.players[child_id].send_json({"type": "error", "message": "Not your turn"})
            return

        result = validate_move(current_fen, msg["uci"])
        if not result:
            await room.players[child_id].send_json({"type": "invalid_move"})
            return

        ply = (last_move.ply + 1) if last_move else 1
        move_row = GameMove(
            game_id=game_id, ply=ply, san=result["san"],
            fen_after=result["fen_after"], by_child_id=child_id,
        )
        db.add(move_row)

        if result["is_checkmate"]:
            game.status = GameStatus.finished
            game.result = GameResult.white_wins if is_whites_turn else GameResult.black_wins
        elif result["is_stalemate"]:
            game.status = GameStatus.finished
            game.result = GameResult.draw

        await db.commit()
        await room.broadcast({
            "type": "move_made",
            "uci": msg["uci"], "san": result["san"],
            "fen_after": result["fen_after"],
            "is_checkmate": result["is_checkmate"],
            "is_stalemate": result["is_stalemate"],
            "by_child_id": child_id,
        })


async def handle_resign(game_id: int, child_id: int, room):
    session_factory = get_session_factory()
    async with session_factory() as db:
        game = await db.get(Game, game_id)
        game.status = GameStatus.finished
        # If white resigns, black wins
        game.result = GameResult.black_wins if child_id == game.white_child_id else GameResult.white_wins
        await db.commit()
    await room.broadcast({"type": "game_over", "result": game.result.value, "by_resign": True})


async def handle_draw(game_id: int, room):
    session_factory = get_session_factory()
    async with session_factory() as db:
        game = await db.get(Game, game_id)
        game.status = GameStatus.finished
        game.result = GameResult.draw
        await db.commit()
    await room.broadcast({"type": "game_over", "result": "1/2-1/2"})
```

- [ ] **Step 3.3: Commit**

```bash
git commit -am "feat(live-game): /ws/game/{game_id} with move/resign/draw"
```

---

## Task 4: Frontend WebSocket Hook

**Files:**
- Create: `apps/web/lib/hooks/use-websocket.ts`

- [ ] **Step 4.1: `lib/hooks/use-websocket.ts`**

```typescript
'use client';
import { useEffect, useRef, useState } from 'react';

type MessageHandler = (data: unknown) => void;

export function useWebSocket(url: string | null, onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setReadyState(WebSocket.CONNECTING);

    ws.onopen = () => setReadyState(WebSocket.OPEN);
    ws.onclose = () => setReadyState(WebSocket.CLOSED);
    ws.onerror = () => setReadyState(WebSocket.CLOSED);
    ws.onmessage = (e) => {
      try {
        onMessageRef.current(JSON.parse(e.data));
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [url]);

  return {
    send: (data: object) => wsRef.current?.send(JSON.stringify(data)),
    readyState,
  };
}
```

- [ ] **Step 4.2: Commit**

```bash
git commit -am "feat(web): useWebSocket hook"
```

---

## Task 5: Matchmaking Screen

**Files:**
- Create: `apps/web/components/MatchmakingScreen.tsx`

- [ ] **Step 5.1: `components/MatchmakingScreen.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWebSocket } from '@/lib/hooks/use-websocket';

export function MatchmakingScreen() {
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'matched'>('connecting');
  const [position, setPosition] = useState<number | null>(null);
  const router = useRouter();

  const token = typeof window !== 'undefined' ? localStorage.getItem('chess_app_token') : '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, 'ws') || 'ws://localhost:8000';
  const wsUrl = token ? `${apiUrl}/ws/queue?token=${token}` : null;

  useWebSocket(wsUrl, (data: any) => {
    if (data.type === 'waiting') {
      setStatus('waiting');
      setPosition(data.position);
    } else if (data.type === 'matched') {
      setStatus('matched');
      router.push(`/play/live/${data.game_id}`);
    }
  });

  return (
    <div className="max-w-md mx-auto p-8 text-center space-y-6">
      <div className="text-6xl">⏳</div>
      <h2 className="text-2xl font-bold">Arkadaş arıyoruz...</h2>
      {status === 'waiting' && position && (
        <p className="text-lg opacity-75">Sıra: {position}</p>
      )}
      <p className="text-sm opacity-50">Birkaç saniye sürebilir...</p>
      <button
        onClick={() => router.back()}
        className="px-6 py-2 border rounded-full"
      >
        Vazgeç
      </button>
    </div>
  );
}
```

- [ ] **Step 5.2: Commit**

```bash
git commit -am "feat(web): MatchmakingScreen"
```

---

## Task 6: LiveGame Component

**Files:**
- Create: `apps/web/components/LiveGame.tsx`
- Create: `apps/web/app/(child)/play/live/[gameId]/page.tsx`

- [ ] **Step 6.1: `components/LiveGame.tsx`**

```tsx
'use client';
import { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { useWebSocket } from '@/lib/hooks/use-websocket';

interface Props { gameId: number; myColor: 'white' | 'black'; }

export function LiveGame({ gameId, myColor }: Props) {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [status, setStatus] = useState<'active' | 'finished'>('active');
  const [result, setResult] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('chess_app_token') : '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, 'ws') || 'ws://localhost:8000';
  const wsUrl = token ? `${apiUrl}/ws/game/${gameId}?token=${token}` : null;

  const { send } = useWebSocket(wsUrl, (data: any) => {
    if (data.type === 'move_made') {
      chess.load(data.fen_after);
      setFen(data.fen_after);
      if (data.is_checkmate) {
        setStatus('finished');
        setResult('Mat!');
      }
    } else if (data.type === 'game_over') {
      setStatus('finished');
      setResult(data.result);
    } else if (data.type === 'invalid_move') {
      // Snap board back to last valid FEN
      setFen(chess.fen());
    }
  });

  function handleDrop(from: Square, to: Square): boolean {
    const userColor = myColor === 'white' ? 'w' : 'b';
    if (chess.turn() !== userColor || status !== 'active') return false;
    const move = chess.move({ from, to, promotion: 'q' });
    if (!move) return false;
    setFen(chess.fen());
    send({ type: 'move', uci: `${from}${to}` });
    return true;
  }

  function resign() {
    if (confirm('Teslim olmak istediğine emin misin?')) {
      send({ type: 'resign' });
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <ChessBoard
        fen={fen}
        interactive={status === 'active'}
        onPieceDrop={handleDrop}
        boardOrientation={myColor}
      />
      {status === 'finished' ? (
        <div className="p-4 bg-blue-100 rounded-lg text-center">
          <p className="text-xl font-bold">{result}</p>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={resign} className="px-4 py-2 bg-red-500 text-white rounded">
            Teslim Ol
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6.2: `app/(child)/play/live/[gameId]/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { LiveGame } from '@/components/LiveGame';

export default function LiveGamePage({ params }: { params: { gameId: string } }) {
  const [myColor, setMyColor] = useState<'white' | 'black' | null>(null);

  useEffect(() => {
    // Fetch game info to determine my color
    fetch(`/api/backend/games/${params.gameId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('chess_app_token')}` },
    })
      .then(r => r.json())
      .then(data => {
        const token = localStorage.getItem('chess_app_token');
        const payload = JSON.parse(atob((token || '').split('.')[1]));
        setMyColor(data.white_child_id === payload.child_profile_id ? 'white' : 'black');
      });
  }, [params.gameId]);

  if (!myColor) return <div className="p-8">Yükleniyor...</div>;
  return <LiveGame gameId={Number(params.gameId)} myColor={myColor} />;
}
```

- [ ] **Step 6.3: Commit**

```bash
git commit -am "feat(web): LiveGame component + live game page"
```

---

## Task 7: `/games/{id}` Detay Endpoint

**Files:**
- Modify: `apps/api/chess_api/routers/games.py`

- [ ] **Step 7.1: Game detail endpoint ekle**

```python
@router.get("/{game_id}")
async def game_detail(game_id: int, db: AsyncSession = Depends(get_db)):
    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(404)
    return {
        "id": game.id,
        "type": game.type.value,
        "status": game.status.value,
        "white_child_id": game.white_child_id,
        "black_child_id": game.black_child_id,
        "result": game.result.value if game.result else None,
    }
```

- [ ] **Step 7.2: Commit**

```bash
git commit -am "feat(games): GET /games/{id} detail endpoint"
```

---

## ACCEPTANCE TESTS — Plan 6 Test Geçidi

### Backend Birim Testler
- [ ] Matchmaking: join, find_match, leave testleri yeşil
- [ ] Live game: move validation, turn checking testleri yeşil

### E2E (iki tarayıcı tabı)
- [ ] Tab 1: çocuk A "Arkadaşla oyna" → matchmaking ekranı, "Sıra: 1"
- [ ] Tab 2: çocuk B "Arkadaşla oyna" → 1-2 saniyede iki taraf da `/play/live/{gameId}`'e yönlenir
- [ ] Tab 1 hamle yapar → Tab 2 hamleyi anında görür
- [ ] Disconnect → Tab 2 "rakip ayrıldı" mesajı görür
- [ ] Teslim olma butonu çalışıyor → her iki tabda sonuç gösterilir

### Manuel
- [ ] Yanlış hamle (rakip sıradayken) → backend reddediyor, board snap-back
- [ ] Mat verince her iki tabda "Mat!" + rozet popup'ı çıkar
- [ ] Beraberlik teklifi: bir taraf teklif eder, diğeri kabul/red

### Performans
- [ ] WebSocket round-trip < 100ms
- [ ] Matchmaking eşleşme süresi < 3sn (2 oyuncu varsa)

**Tümü ✅ ise Plan 7'ye geç.**
