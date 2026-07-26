# Lobi Teklif Panosu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Arkadaşla Oyna"yı doğrudan davet modelinden, sporcuların teklif bırakıp başkalarının tek dokunuşla alabildiği bir **teklif panosuna** çevirmek.

**Architecture:** Teklifler sunucu belleğinde (`offers.py`), renk çözümü ayrı ve saf (`offer_sides.py`), taşıma mevcut `/ws/lobby` soketi üzerinden. Frontend'de saf gösterim mantığı (`offers.ts`) + tek bileşen (`OfferBoard.tsx`). Doğrudan davet altyapısına dokunulmaz.

**Tech Stack:** FastAPI + WebSocket, SQLAlchemy 2 async (yalnızca mevcut `_create_human_game` çağrısı), pytest; Next.js 15 / React 19 / TypeScript, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-26-lobi-teklif-panosu-design.md`

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/api/chess_api/services/offers.py` **(yeni)** | Bellek içi teklif panosu. Tek teklif kuralı + atomik çekme. |
| `apps/api/chess_api/services/offer_sides.py` **(yeni)** | Saf renk çözümü. Rastgelelik parametre olarak gelir. |
| `apps/api/chess_api/services/lobby.py` **(değişir)** | `connected_ids()` eklenir (yayın için). |
| `apps/api/chess_api/routers/live_game.py` **(değişir)** | 3 yeni WS mesajı + yayın yardımcısı + kopunca teklif silme. |
| `apps/web/lib/play/offers.ts` **(yeni)** | Saf: tempo emojisi, kabul edenin rengi, satır özeti. |
| `apps/web/lib/hooks/use-lobby.ts` **(değişir)** | `offers`, `myOffer`, `notice`, `createOffer`, `cancelOffer`, `takeOffer`. |
| `apps/web/components/play/OfferBoard.tsx` **(yeni)** | Pano + OYNA + teklif formu + iptal satırı. |
| `apps/web/app/(child)/play/page.tsx` **(değişir)** | `mode === 'friend'` → `OfferBoard`. |

**Dokunulmaz:** `ChallengeScreen.tsx`, `MatchCriteria.tsx`, `presence.py`, tüm migration'lar
(yeni tablo YOK), `_handle_challenge*` fonksiyonları.

---

## Task 1: `offers.py` bellek içi pano

**Files:**
- Create: `apps/api/chess_api/services/offers.py`
- Test: `apps/api/tests/test_offers.py`

- [ ] **Step 1: Write the failing test**

`apps/api/tests/test_offers.py`:

```python
import pytest
from chess_api.services.offers import (
    create_offer, cancel_offer, list_offers, take_offer, my_offer, _reset_for_tests,
)


def _make(child_id=1, name="Ayse", color="white"):
    return create_offer(
        child_id=child_id, display_name=name, tempo="Yildirim",
        tc_label="5+0", tc_base=300, tc_increment=0, color=color,
    )


def setup_function():
    _reset_for_tests()


def test_olusturulan_teklif_listede_gorunur():
    _make()
    offers = list_offers(exclude=None)
    assert len(offers) == 1
    assert offers[0]["display_name"] == "Ayse"
    assert offers[0]["tc_label"] == "5+0"
    assert offers[0]["color"] == "white"


def test_ayni_cocugun_ikinci_teklifi_ustune_yazar():
    _make(child_id=1, color="white")
    _make(child_id=1, color="black")
    offers = list_offers(exclude=None)
    assert len(offers) == 1
    assert offers[0]["color"] == "black"


def test_exclude_kendi_teklifini_gizler():
    _make(child_id=1)
    _make(child_id=2, name="Mehmet")
    offers = list_offers(exclude=1)
    assert [o["child_id"] for o in offers] == [2]


def test_take_offer_teklifi_dondurur_ve_panodan_siler():
    _make(child_id=1)
    taken = take_offer(1)
    assert taken is not None and taken["child_id"] == 1
    assert list_offers(exclude=None) == []


def test_take_offer_ikinci_cagride_none_doner():
    """YARIS DURUMU: iki sporcu ayni teklife bassa yalnizca biri alir."""
    _make(child_id=1)
    assert take_offer(1) is not None
    assert take_offer(1) is None


def test_cancel_offer_siler_ve_olmayan_icin_hata_vermez():
    _make(child_id=1)
    cancel_offer(1)
    assert list_offers(exclude=None) == []
    cancel_offer(999)  # patlamamali


def test_gecersiz_renk_valueerror():
    with pytest.raises(ValueError):
        _make(color="mor")


def test_my_offer_kendi_teklifini_dondurur():
    """Sunucu herkese KENDI teklifi HARIC liste gonderir; sporcunun kendi
    teklifini gorebilmesi icin ayri bir kapi gerekir."""
    _make(child_id=1)
    assert my_offer(1)["tc_label"] == "5+0"
    assert my_offer(2) is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_offers.py -q
```

Beklenen: FAIL — `ModuleNotFoundError: No module named 'chess_api.services.offers'`.

- [ ] **Step 3: Write the implementation**

`apps/api/chess_api/services/offers.py`:

```python
"""In-memory teklif panosu: sporcularin biraktigi acik mac teklifleri.

lobby.py ve presence.py ile ayni deseni izler (tek instance deploy varsayimi).
Coklu instance icin Redis pub/sub gerekir — mevcut lobby.py, matchmaking.py ve
game_room.py'de de ayni sinir var.

Teklif KALICI DEGILDIR: sporcu lobiden ciktigi an silinir, sunucu yeniden
baslarsa pano bosalir. Bu yuzden veritabani tablosu yoktur.
"""
from typing import Any

VALID_COLORS = ("white", "black", "random")

# child_id -> teklif. Bir cocugun AYNI ANDA tek teklifi olabilir.
_offers: dict[int, dict[str, Any]] = {}


def create_offer(child_id: int, display_name: str, tempo: str, tc_label: str,
                 tc_base: int, tc_increment: int, color: str) -> dict[str, Any]:
    """Yeni teklif. Ayni cocugun eski teklifi USTUNE YAZILIR (tek teklif kurali)."""
    if color not in VALID_COLORS:
        raise ValueError(f"gecersiz renk: {color}")
    offer: dict[str, Any] = {
        "child_id": child_id,
        "display_name": display_name,
        "tempo": tempo,
        "tc_label": tc_label,
        "tc_base": tc_base,
        "tc_increment": tc_increment,
        "color": color,
    }
    _offers[child_id] = offer
    return offer


def cancel_offer(child_id: int) -> None:
    """Teklifi kaldirir. Teklif yoksa sessizce gecer."""
    _offers.pop(child_id, None)


def list_offers(exclude: int | None = None) -> list[dict[str, Any]]:
    """Panodaki teklifler. exclude verilirse o cocugun teklifi cikarilir."""
    return [o for cid, o in _offers.items() if cid != exclude]


def take_offer(child_id: int) -> dict[str, Any] | None:
    """Teklifi panodan CEKER ve dondurur; yoksa None.

    Yaris durumunun tek savunmasi budur: iki sporcu ayni teklife ayni anda
    bassa dict.pop yalnizca birinde deger dondurur (tek olay dongusu).
    """
    return _offers.pop(child_id, None)


def my_offer(child_id: int) -> dict[str, Any] | None:
    """Sporcunun KENDI teklifi. list_offers herkese kendi teklifi haric liste
    gonderdigi icin, sporcu kendi teklifini ancak buradan gorebilir."""
    return _offers.get(child_id)


def _reset_for_tests() -> None:
    _offers.clear()
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && python -m pytest tests/test_offers.py -q
```

Beklenen: PASS — 8 test.

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/services/offers.py apps/api/tests/test_offers.py
git commit -m "feat: bellek ici teklif panosu servisi"
```

---

## Task 2: `offer_sides.py` saf renk çözümü

**Files:**
- Create: `apps/api/chess_api/services/offer_sides.py`
- Test: `apps/api/tests/test_offer_sides.py`

- [ ] **Step 1: Write the failing test**

`apps/api/tests/test_offer_sides.py`:

```python
import pytest
from chess_api.services.offer_sides import resolve_sides

OWNER, TAKER = 10, 20


def test_teklif_beyaz_ise_sahibi_beyaz_olur():
    assert resolve_sides("white", OWNER, TAKER, coin=True) == (OWNER, TAKER)
    # coin degeri 'white'ta HIC kullanilmaz
    assert resolve_sides("white", OWNER, TAKER, coin=False) == (OWNER, TAKER)


def test_teklif_siyah_ise_kabul_eden_beyaz_olur():
    assert resolve_sides("black", OWNER, TAKER, coin=True) == (TAKER, OWNER)
    assert resolve_sides("black", OWNER, TAKER, coin=False) == (TAKER, OWNER)


def test_rastgele_cekilise_baglidir():
    assert resolve_sides("random", OWNER, TAKER, coin=True) == (OWNER, TAKER)
    assert resolve_sides("random", OWNER, TAKER, coin=False) == (TAKER, OWNER)


def test_gecersiz_renk_valueerror():
    with pytest.raises(ValueError):
        resolve_sides("mor", OWNER, TAKER, coin=True)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_offer_sides.py -q
```

Beklenen: FAIL — `ModuleNotFoundError: No module named 'chess_api.services.offer_sides'`.

- [ ] **Step 3: Write the implementation**

`apps/api/chess_api/services/offer_sides.py`:

```python
"""Teklif alindiginda kimin beyaz kimin siyah oynayacagini belirler.

Rastgelelik PARAMETRE olarak gelir (coin) — boylece test 'random' modulunu
yamalamak zorunda kalmaz. presence.py'deki 'now' enjeksiyonuyla ayni fikir.
"""


def resolve_sides(owner_color: str, owner_id: int, taker_id: int,
                  coin: bool) -> tuple[int, int]:
    """(white_child_id, black_child_id) doner.

    owner_color 'white'  -> teklif sahibi beyaz, kabul eden siyah
    owner_color 'black'  -> teklif sahibi siyah, kabul eden beyaz
    owner_color 'random' -> coin True ise sahibi beyaz, False ise kabul eden
    """
    if owner_color == "white":
        return owner_id, taker_id
    if owner_color == "black":
        return taker_id, owner_id
    if owner_color == "random":
        return (owner_id, taker_id) if coin else (taker_id, owner_id)
    raise ValueError(f"gecersiz renk: {owner_color}")
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && python -m pytest tests/test_offer_sides.py -q
```

Beklenen: PASS — 4 test.

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/services/offer_sides.py apps/api/tests/test_offer_sides.py
git commit -m "feat: teklif renk cozumu (saf, cekilis enjekte)"
```

---

## Task 3: `lobby.connected_ids()`

**Files:**
- Modify: `apps/api/chess_api/services/lobby.py` (dosyanın sonuna, `_reset_for_tests` öncesine)
- Test: `apps/api/tests/test_lobby.py` (mevcut dosyaya EKLEME)

- [ ] **Step 1: Write the failing test**

`apps/api/tests/test_lobby.py` dosyasının **sonuna** ekle (mevcut testlere dokunma).
Dosyanın en üstündeki import satırına `connected_ids` de eklenmeli:

```python
def test_connected_ids_katilan_cocugu_icerir_ayrilani_icermez():
    """Yayin yapan taraf lobideki herkesi gezebilmeli (teklif panosu icin)."""
    from chess_api.services.lobby import (
        join_lobby, leave_lobby, connected_ids, _reset_for_tests,
    )

    class _Sender:
        async def send_json(self, data: dict) -> None:
            pass

    _reset_for_tests()
    join_lobby(1, "Ayse", _Sender())
    join_lobby(2, "Mehmet", _Sender())
    assert sorted(connected_ids()) == [1, 2]

    leave_lobby(1)
    assert connected_ids() == [2]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_lobby.py -q
```

Beklenen: FAIL — `ImportError: cannot import name 'connected_ids'`.

- [ ] **Step 3: Write the implementation**

`apps/api/chess_api/services/lobby.py` içinde, `send_to_player` fonksiyonundan
**sonra** ve `_reset_for_tests`'ten **önce** şunu ekle:

```python
def connected_ids() -> list[int]:
    """Lobideki tum cocuk id'leri.

    Yayin yapan taraf bunu gezip send_to_player ile HER SPORCUYA KENDI haric
    listesini gonderir (teklif panosu). _players dis dunyaya kapali kalsin
    diye yalnizca id'ler donulur.
    """
    return list(_players.keys())
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && python -m pytest tests/test_lobby.py -q
```

Beklenen: PASS — mevcut testler + 1 yeni test.

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/services/lobby.py apps/api/tests/test_lobby.py
git commit -m "feat: lobby.connected_ids (pano yayini icin)"
```

---

## Task 4: `/ws/lobby` teklif mesajları

**Files:**
- Modify: `apps/api/chess_api/routers/live_game.py`
- Test: `apps/api/tests/test_lobby_ws.py` (mevcut dosyaya EKLEME)

- [ ] **Step 1: Write the failing test**

`apps/api/tests/test_lobby_ws.py` dosyasının **sonuna** ekle:

```python
def test_lobby_joined_offers_alani_tasir(monkeypatch):
    """Baglanir baglanmaz pano dolu gelmeli (bos da olsa alan bulunmali)."""
    from chess_api.services.offers import _reset_for_tests as _reset_offers
    _reset_for_tests()
    _reset_offers()

    async def _fake_name(child_id):
        return "Test Sporcu"

    monkeypatch.setattr(
        "chess_api.routers.live_game._resolve_display_name", _fake_name,
    )
    client = TestClient(create_app())
    token = encode_token({"child_profile_id": 1, "role": "child"})
    with client.websocket_connect(f"/ws/lobby?token={token}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "lobby_joined"
        assert msg["offers"] == []
        assert msg["my_offer"] is None
        assert msg["players"] == []  # REGRESYON: dogrudan davet alani duruyor


def test_offer_create_panoyu_yayinlar(monkeypatch):
    """Teklif birakan sporcu KENDI teklifini gormez; yayin yine de gelir."""
    from chess_api.services.offers import (
        list_offers, _reset_for_tests as _reset_offers,
    )
    _reset_for_tests()
    _reset_offers()

    async def _fake_name(child_id):
        return "Test Sporcu"

    monkeypatch.setattr(
        "chess_api.routers.live_game._resolve_display_name", _fake_name,
    )
    client = TestClient(create_app())
    token = encode_token({"child_profile_id": 1, "role": "child"})
    with client.websocket_connect(f"/ws/lobby?token={token}") as ws:
        ws.receive_json()  # lobby_joined
        ws.send_json({
            "type": "offer_create", "tempo": "Yildirim", "tc_label": "5+0",
            "tc_base": 300, "tc_increment": 0, "color": "white",
        })
        msg = ws.receive_json()
        assert msg["type"] == "offers"
        assert msg["offers"] == []          # kendi teklifi haric
        # Ama KENDI teklifini ayri alanda gorur:
        assert msg["my_offer"]["tc_label"] == "5+0"
        # Panoda gercekten var:
        assert len(list_offers(exclude=None)) == 1


def test_offer_take_kendi_teklifine_offer_gone(monkeypatch):
    _reset_for_tests()
    from chess_api.services.offers import _reset_for_tests as _reset_offers
    _reset_offers()

    async def _fake_name(child_id):
        return "Test Sporcu"

    monkeypatch.setattr(
        "chess_api.routers.live_game._resolve_display_name", _fake_name,
    )
    client = TestClient(create_app())
    token = encode_token({"child_profile_id": 1, "role": "child"})
    with client.websocket_connect(f"/ws/lobby?token={token}") as ws:
        ws.receive_json()  # lobby_joined
        ws.send_json({"type": "offer_take", "child_id": 1})
        msg = ws.receive_json()
        assert msg["type"] == "offer_gone"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_lobby_ws.py -q
```

Beklenen: FAIL — `lobby_joined` mesajında `offers` anahtarı yok (`KeyError`).

- [ ] **Step 3: Write the implementation**

**3a.** `apps/api/chess_api/routers/live_game.py` en üstteki import bloğuna ekle:

```python
import random
```

ve mevcut lobby import satırını genişlet:

```python
from chess_api.services.lobby import (
    join_lobby, leave_lobby, online_players, send_to_player, connected_ids,
)
from chess_api.services.offers import (
    create_offer, cancel_offer, list_offers, take_offer, my_offer,
)
from chess_api.services.offer_sides import resolve_sides
```

**3b.** `_handle_challenge_decline` fonksiyonundan **sonra**, `@router.websocket("/ws/lobby")`
satırından **önce** dört fonksiyon ekle:

```python
async def _broadcast_offers() -> None:
    """Panoyu lobideki HERKESE gonderir.

    Her sporcu KENDI teklifi HARIC listeyi gorur (offers) + varsa KENDI
    teklifini ayri alanda gorur (my_offer) — "Teklifin panoda" satiri icin.

    send_to_player kopmus sokette sessizce False donduğu icin ayri hata
    yonetimi gerekmez (mevcut davranis).
    """
    for cid in connected_ids():
        await send_to_player(cid, {
            "type": "offers",
            "offers": list_offers(exclude=cid),
            "my_offer": my_offer(cid),
        })


async def _handle_offer_create(child_id: int, msg: dict) -> None:
    name = await _resolve_display_name(child_id)
    try:
        create_offer(
            child_id=child_id,
            display_name=name,
            tempo=str(msg.get("tempo") or ""),
            tc_label=str(msg.get("tc_label") or ""),
            tc_base=int(msg.get("tc_base") or 0),
            tc_increment=int(msg.get("tc_increment") or 0),
            color=str(msg.get("color") or "random"),
        )
    except (ValueError, TypeError):
        return  # gecersiz teklif sessizce yok sayilir; pano degismez
    await _broadcast_offers()


async def _handle_offer_cancel(child_id: int) -> None:
    cancel_offer(child_id)
    await _broadcast_offers()


async def _handle_offer_take(child_id: int, msg: dict) -> None:
    """Panodan teklif alma. Teklif cekilemezse basana offer_gone doner."""
    owner = msg.get("child_id")
    if not isinstance(owner, int) or owner == child_id:
        await send_to_player(child_id, {"type": "offer_gone"})
        return

    offer = take_offer(owner)
    if offer is None:
        await send_to_player(child_id, {"type": "offer_gone"})
        return
    if owner not in connected_ids():
        # Teklif sahibi tam bu sirada koptu; teklif zaten cekildi.
        await send_to_player(child_id, {"type": "offer_gone"})
        await _broadcast_offers()
        return

    white_id, black_id = resolve_sides(
        offer["color"], owner, child_id, coin=random.random() < 0.5,
    )
    game_id = await _create_human_game(white_id, black_id)

    await send_to_player(owner, {
        "type": "matched", "game_id": game_id,
        "color": "white" if white_id == owner else "black",
        "opponent_id": child_id,
    })
    await send_to_player(child_id, {
        "type": "matched", "game_id": game_id,
        "color": "white" if white_id == child_id else "black",
        "opponent_id": owner,
    })
    await _broadcast_offers()
```

**3c.** `lobby_ws` içinde `lobby_joined` gönderen satırı değiştir:

```python
    await websocket.send_json({
        "type": "lobby_joined",
        "players": online_players(exclude=child_id),
        "offers": list_offers(exclude=child_id),
        "my_offer": my_offer(child_id),
    })
```

**3d.** `lobby_ws` içindeki mesaj döngüsüne üç dal ekle:

```python
            if mtype == "challenge":
                await _handle_challenge(child_id, msg)
            elif mtype == "challenge_accept":
                await _handle_challenge_accept(child_id, msg)
            elif mtype == "challenge_decline":
                await _handle_challenge_decline(child_id, msg)
            elif mtype == "offer_create":
                await _handle_offer_create(child_id, msg)
            elif mtype == "offer_cancel":
                await _handle_offer_cancel(child_id)
            elif mtype == "offer_take":
                await _handle_offer_take(child_id, msg)
```

**3e.** `lobby_ws` sonundaki iki `leave_lobby` çağrısını da teklif temizliğiyle genişlet:

```python
    except WebSocketDisconnect:
        leave_lobby(child_id)
        cancel_offer(child_id)
        await _broadcast_offers()
    except Exception:
        logger.exception("lobby_ws error")
        leave_lobby(child_id)
        cancel_offer(child_id)
        await _broadcast_offers()
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && python -m pytest tests/test_lobby_ws.py -q
```

Beklenen: PASS — mevcut 2 test + 3 yeni test.

- [ ] **Step 5: Backend tam paket**

```bash
cd apps/api && python -m pytest -q
```

Beklenen: hepsi PASS. Referans: P10 sonunda 275 test geçiyordu; bu planla
Task 1 → +8, Task 2 → +4, Task 3 → +1, Task 4 → +3. Toplam beklenen: **291**.
Sayı tutmuyorsa DUR ve nedenini bul.

- [ ] **Step 6: Commit**

```bash
git add apps/api/chess_api/routers/live_game.py apps/api/tests/test_lobby_ws.py
git commit -m "feat: /ws/lobby teklif panosu mesajlari"
```

---

## Task 5: `offers.ts` saf gösterim mantığı

**Files:**
- Create: `apps/web/lib/play/offers.ts`
- Test: `apps/web/tests/offers.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/tests/offers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tempoEmoji, takerColorChoice, offerSummary } from '@/lib/play/offers';
import type { LobbyOffer } from '@/lib/play/offers';

const OFFER: LobbyOffer = {
  child_id: 7,
  display_name: 'Ayşe',
  tempo: 'Yıldırım',
  tc_label: '5+0',
  tc_base: 300,
  tc_increment: 0,
  color: 'white',
};

describe('tempoEmoji', () => {
  it('bilinen tempolar için doğru emoji döner', () => {
    expect(tempoEmoji('Yıldırım')).toBe('⚡');
    expect(tempoEmoji('Hızlı')).toBe('🚀');
    expect(tempoEmoji('Klasik')).toBe('🐢');
  });

  it('bilinmeyen tempo için boş dizge döner (uydurmaz)', () => {
    expect(tempoEmoji('Kaplumbağa Ligi')).toBe('');
  });
});

describe('takerColorChoice', () => {
  it('teklif beyazsa kabul eden siyah oynar', () => {
    expect(takerColorChoice('white')).toBe('black');
  });

  it('teklif siyahsa kabul eden beyaz oynar', () => {
    expect(takerColorChoice('black')).toBe('white');
  });

  it('rastgele teklifte kabul eden de rastgeledir', () => {
    expect(takerColorChoice('random')).toBe('random');
  });
});

describe('offerSummary', () => {
  it('tempo, süre ve KABUL EDENİN rengini birleştirir', () => {
    expect(offerSummary(OFFER)).toBe('⚡ Yıldırım · 5+0 · Sen: ⚫ Siyah');
  });

  it('rastgele teklifte renk rastgele gösterilir', () => {
    expect(offerSummary({ ...OFFER, color: 'random' }))
      .toBe('⚡ Yıldırım · 5+0 · Sen: 🎲 Rastgele');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run tests/offers.test.ts
```

Beklenen: FAIL — `Failed to resolve import "@/lib/play/offers"`.

- [ ] **Step 3: Write the implementation**

`apps/web/lib/play/offers.ts`:

```ts
import { TIME_GROUPS } from '@/lib/play/levels';
import { COLOR_CHOICES } from '@/lib/play/color';
import type { ColorChoice } from '@/lib/play/color';

/** Sunucudan gelen teklif satiri (/ws/lobby "offers" mesaji). */
export interface LobbyOffer {
  child_id: number;
  display_name: string;
  tempo: string;
  tc_label: string;
  tc_base: number;
  tc_increment: number;
  color: ColorChoice;
}

/** Tempo adinin emojisi. Bilinmeyen tempo icin BOS dizge — uydurulmaz. */
export function tempoEmoji(tempo: string): string {
  return TIME_GROUPS.find((g) => g.cat === tempo)?.emoji ?? '';
}

/** Teklifi ALANIN oynayacagi renk. Panoya bakan kisi icin anlamli olan budur. */
export function takerColorChoice(owner: ColorChoice): ColorChoice {
  if (owner === 'white') return 'black';
  if (owner === 'black') return 'white';
  return 'random';
}

/** Satir ozeti: "⚡ Yildirim · 5+0 · Sen: ⚫ Siyah" */
export function offerSummary(o: LobbyOffer): string {
  const taker = takerColorChoice(o.color);
  const c = COLOR_CHOICES.find((x) => x.value === taker);
  const emoji = tempoEmoji(o.tempo);
  const tempoPart = emoji ? `${emoji} ${o.tempo}` : o.tempo;
  return `${tempoPart} · ${o.tc_label} · Sen: ${c?.emoji ?? ''} ${c?.label ?? ''}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run tests/offers.test.ts
```

Beklenen: PASS — 7 test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/offers.ts apps/web/tests/offers.test.ts
git commit -m "feat: teklif panosu saf gosterim mantigi"
```

---

## Task 6: `use-lobby` teklif API'si

**Files:**
- Modify: `apps/web/lib/hooks/use-lobby.ts`
- Test: yok (bu hook WS'e bağlı; davranışı Task 7'de `OfferBoard` testlerinde mock'lanarak doğrulanır — mevcut `use-lobby` için de birim testi yoktur, desen korunur)

- [ ] **Step 1: Implementation**

`apps/web/lib/hooks/use-lobby.ts` dosyasının **tamamını** aşağıdakiyle değiştir:

```ts
'use client';
import { useState } from 'react';
import { getToken } from '@/lib/auth-storage';
import { useWebSocket, wsBase } from '@/lib/hooks/use-websocket';
import type { LobbyOffer } from '@/lib/play/offers';
import type { ColorChoice } from '@/lib/play/color';

export interface OnlinePlayer { child_id: number; display_name: string }

export interface IncomingChallenge {
  from_child_id: number;
  from_name: string;
  criteria: Record<string, unknown>;
}

export interface MatchedInfo { gameId: number; color: 'white' | 'black' }

/** Yeni teklif olustururken gonderilen alanlar (Tempo-Sure-Renk yeterli). */
export interface NewOffer {
  tempo: string;
  tc_label: string;
  tc_base: number;
  tc_increment: number;
  color: ColorChoice;
}

interface Options {
  onMatched: (info: MatchedInfo) => void;
}

/** /ws/lobby baglantisi: teklif panosu + aktif sporcu listesi + dogrudan davetler. */
export function useLobby({ onMatched }: Options) {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [offers, setOffers] = useState<LobbyOffer[]>([]);
  /** Sporcunun KENDI teklifi — panoda kendisine gosterilmez, ayri alanda gelir. */
  const [myOffer, setMyOffer] = useState<LobbyOffer | null>(null);
  const [incoming, setIncoming] = useState<IncomingChallenge | null>(null);
  const [notice, setNotice] = useState<string>('');

  const token = typeof window !== 'undefined' ? getToken() : null;
  const url = token ? `${wsBase()}/ws/lobby?token=${encodeURIComponent(token)}` : null;

  const { send } = useWebSocket(url, (data: unknown) => {
    const msg = data as {
      type?: string;
      players?: OnlinePlayer[];
      offers?: LobbyOffer[];
      my_offer?: LobbyOffer | null;
      from_child_id?: number;
      from_name?: string;
      criteria?: Record<string, unknown>;
      game_id?: number;
      color?: string;
    };
    const t = msg?.type;
    if (t === 'lobby_joined') {
      setPlayers(msg.players ?? []);
      setOffers(msg.offers ?? []);
      setMyOffer(msg.my_offer ?? null);
    } else if (t === 'offers') {
      setOffers(msg.offers ?? []);
      setMyOffer(msg.my_offer ?? null);
    } else if (t === 'offer_gone') {
      setNotice('Bu teklif alındı. Başka bir teklif seç.');
    } else if (t === 'challenge_received') {
      setIncoming({
        from_child_id: msg.from_child_id ?? 0,
        from_name: msg.from_name ?? 'Sporcu',
        criteria: msg.criteria ?? {},
      });
    } else if (t === 'challenge_declined') {
      setNotice('Teklifin reddedildi.');
    } else if (t === 'matched' && typeof msg.game_id === 'number') {
      onMatched({ gameId: msg.game_id, color: msg.color === 'black' ? 'black' : 'white' });
    }
  });

  return {
    players,
    offers,
    myOffer,
    incoming,
    notice,
    /** Panoya kendi teklifini birak (eskisi varsa uzerine yazilir). */
    createOffer: (o: NewOffer) => {
      setNotice('');
      send({ type: 'offer_create', ...o });
    },
    /** Kendi teklifini panodan kaldir. */
    cancelOffer: () => send({ type: 'offer_cancel' }),
    /** Panodaki bir teklifi al — basarili olursa 'matched' gelir. */
    takeOffer: (ownerChildId: number) => {
      setNotice('');
      send({ type: 'offer_take', child_id: ownerChildId });
    },
    /** Belirli bir sporcuya davet gonder (dogrudan davet — 4. alt proje kullanir). */
    challenge: (targetChildId: number, criteria: Record<string, unknown>) =>
      send({ type: 'challenge', target_child_id: targetChildId, criteria }),
    acceptChallenge: (c: IncomingChallenge) => {
      send({ type: 'challenge_accept', from_child_id: c.from_child_id, criteria: c.criteria });
      setIncoming(null);
    },
    declineChallenge: (c: IncomingChallenge) => {
      send({ type: 'challenge_decline', from_child_id: c.from_child_id });
      setIncoming(null);
    },
  };
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
cd apps/web && npx tsc --noEmit
```

Beklenen: çıktı yok. (`ChallengeScreen` mevcut alanları kullanmaya devam ettiği için
kırılmamalı — kırılırsa DUR, eski API'yi bozmuşsun demektir.)

- [ ] **Step 3: Mevcut testler hâlâ geçiyor mu**

```bash
cd apps/web && npx vitest run
```

Beklenen: 472 test PASS (bu görevde yeni test eklenmedi).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/hooks/use-lobby.ts
git commit -m "feat: use-lobby teklif panosu API'si"
```

---

## Task 7: `OfferBoard` bileşeni

**Files:**
- Create: `apps/web/components/play/OfferBoard.tsx`
- Test: `apps/web/tests/offer-board.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/tests/offer-board.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LobbyOffer } from '@/lib/play/offers';

const createOffer = vi.fn();
const cancelOffer = vi.fn();
const takeOffer = vi.fn();
let offers: LobbyOffer[] = [];
let myOffer: LobbyOffer | null = null;
let notice = '';

vi.mock('@/lib/hooks/use-lobby', () => ({
  useLobby: () => ({
    players: [], incoming: null, offers, myOffer, notice,
    createOffer, cancelOffer, takeOffer,
    challenge: vi.fn(), acceptChallenge: vi.fn(), declineChallenge: vi.fn(),
  }),
}));

import { OfferBoard } from '@/components/play/OfferBoard';

const AYSE: LobbyOffer = {
  child_id: 7, display_name: 'Ayşe', tempo: 'Yıldırım',
  tc_label: '5+0', tc_base: 300, tc_increment: 0, color: 'white',
};
const MEHMET: LobbyOffer = {
  child_id: 9, display_name: 'Mehmet', tempo: 'Hızlı',
  tc_label: '10+0', tc_base: 600, tc_increment: 0, color: 'random',
};

beforeEach(() => {
  createOffer.mockReset();
  cancelOffer.mockReset();
  takeOffer.mockReset();
  offers = [];
  myOffer = null;
  notice = '';
});

describe('OfferBoard', () => {
  it('pano boşken bilgilendirme metni gösterir', () => {
    render(<OfferBoard onMatched={vi.fn()} />);
    expect(screen.getByText(/Şu an açık teklif yok/)).toBeInTheDocument();
  });

  it('teklifleri ad ve özetiyle listeler', () => {
    offers = [AYSE, MEHMET];
    render(<OfferBoard onMatched={vi.fn()} />);
    expect(screen.getByText('Ayşe')).toBeInTheDocument();
    expect(screen.getByText('Mehmet')).toBeInTheDocument();
    expect(screen.getByText('⚡ Yıldırım · 5+0 · Sen: ⚫ Siyah')).toBeInTheDocument();
  });

  it('her teklif satırında bir OYNA düğmesi vardır', () => {
    offers = [AYSE, MEHMET];
    render(<OfferBoard onMatched={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /OYNA/ })).toHaveLength(2);
  });

  it('OYNA doğru child_id ile takeOffer çağırır', () => {
    offers = [AYSE, MEHMET];
    render(<OfferBoard onMatched={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Mehmet teklifini al'));
    expect(takeOffer).toHaveBeenCalledWith(9);
  });

  it('Maç Teklif Et formu açılır ve createOffer doğru değerlerle çağrılır', () => {
    render(<OfferBoard onMatched={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Maç Teklif Et/ }));
    fireEvent.click(screen.getByRole('button', { name: '10+5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siyah' }));
    fireEvent.click(screen.getByRole('button', { name: /Teklifi Yayınla/ }));
    expect(createOffer).toHaveBeenCalledWith({
      tempo: 'Hızlı', tc_label: '10+5', tc_base: 600, tc_increment: 5, color: 'black',
    });
  });

  it('süre seçilmeden Teklifi Yayınla basılamaz', () => {
    render(<OfferBoard onMatched={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Maç Teklif Et/ }));
    fireEvent.click(screen.getByRole('button', { name: /Teklifi Yayınla/ }));
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('kendi teklifi varken "Teklifin panoda" satırı ve iptal düğmesi çıkar', () => {
    myOffer = AYSE;
    render(<OfferBoard onMatched={vi.fn()} />);
    expect(screen.getByText('Teklifin panoda')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Teklifini İptal Et/ }));
    expect(cancelOffer).toHaveBeenCalledTimes(1);
  });

  it('kendi teklifi yokken "Teklifin panoda" satırı ÇIKMAZ', () => {
    render(<OfferBoard onMatched={vi.fn()} />);
    expect(screen.queryByText('Teklifin panoda')).not.toBeInTheDocument();
  });

  it('offer_gone uyarısı ekranda gösterilir', () => {
    notice = 'Bu teklif alındı. Başka bir teklif seç.';
    render(<OfferBoard onMatched={vi.fn()} />);
    expect(screen.getByText(/Bu teklif alındı/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run tests/offer-board.test.tsx
```

Beklenen: FAIL — `Failed to resolve import "@/components/play/OfferBoard"`.

- [ ] **Step 3: Write the implementation**

`apps/web/components/play/OfferBoard.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useLobby } from '@/lib/hooks/use-lobby';
import type { MatchedInfo } from '@/lib/hooks/use-lobby';
import { offerSummary, tempoEmoji } from '@/lib/play/offers';
import { TIME_GROUPS } from '@/lib/play/levels';
import type { TimeControl } from '@/components/BotGame';
import { COLOR_CHOICES } from '@/lib/play/color';
import type { ColorChoice } from '@/lib/play/color';

interface Props {
  onMatched: (info: MatchedInfo) => void;
}

/** Teklif panosu: acik teklifleri listeler, tek dokunusla mac baslatir,
 *  uygun teklif yoksa sporcunun kendi teklifini birakmasini saglar. */
export function OfferBoard({ onMatched }: Props) {
  const { offers, myOffer, notice, createOffer, cancelOffer, takeOffer } =
    useLobby({ onMatched });
  const [formOpen, setFormOpen] = useState(false);
  const [tc, setTc] = useState<{ tempo: string; item: TimeControl } | null>(null);
  const [color, setColor] = useState<ColorChoice>('random');

  const pill = (active: boolean) => ({
    border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
    background: active ? 'color-mix(in srgb, var(--t-accent) 12%, transparent)' : 'var(--t-surface)',
    color: active ? 'var(--t-accent)' : 'var(--t-text)',
  });

  function publish() {
    if (!tc) return;   // sure secilmeden teklif yayinlanmaz
    createOffer({
      tempo: tc.tempo,
      tc_label: tc.item.label,
      tc_base: tc.item.base,
      tc_increment: tc.item.increment,
      color,
    });
    setFormOpen(false);
    setTc(null);
  }

  return (
    <div className="space-y-4">
      {notice && <p className="text-sm" style={{ color: 'var(--t-accent)' }}>{notice}</p>}

      {myOffer && (
        <div className="t-card-i flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold t-muted uppercase tracking-wide">
              Teklifin panoda
            </p>
            <p className="text-sm mt-0.5">
              {tempoEmoji(myOffer.tempo)} {myOffer.tempo} · {myOffer.tc_label} ·{' '}
              {COLOR_CHOICES.find((c) => c.value === myOffer.color)?.label ?? ''}
            </p>
          </div>
          <button type="button" onClick={cancelOffer}
            className="t-btn-ghost px-3 py-2 text-xs flex-shrink-0">
            Teklifini İptal Et
          </button>
        </div>
      )}

      <p className="text-xs font-semibold t-muted uppercase tracking-widest">
        Açık Teklifler ({offers.length})
      </p>

      {offers.length === 0 ? (
        <p className="text-sm t-muted">
          Şu an açık teklif yok. Sen bir teklif bırak, arkadaşların görsün.
        </p>
      ) : (
        <div className="space-y-2">
          {offers.map((o) => (
            <div key={o.child_id} className="t-card-i flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{o.display_name}</p>
                <p className="text-xs t-muted mt-0.5">{offerSummary(o)}</p>
              </div>
              <button
                type="button"
                onClick={() => takeOffer(o.child_id)}
                aria-label={`${o.display_name} teklifini al`}
                className="flex items-center justify-center rounded-full font-bold flex-shrink-0"
                style={{
                  width: 52, height: 52, fontSize: '0.7rem',
                  border: '2px solid var(--t-accent)', color: 'var(--t-accent)',
                }}
              >
                OYNA
              </button>
            </div>
          ))}
        </div>
      )}

      {!formOpen ? (
        <button type="button" onClick={() => setFormOpen(true)}
          className="w-full py-3 rounded-xl text-sm font-bold"
          style={{ background: 'var(--t-accent)', color: '#fff' }}>
          + Maç Teklif Et
        </button>
      ) : (
        <div className="t-card-i p-4 space-y-4">
          {TIME_GROUPS.map((g) => (
            <div key={g.cat} className="space-y-2">
              <p className="text-xs font-semibold t-muted uppercase tracking-wide flex items-center gap-1.5">
                <span>{g.emoji}</span> {g.cat}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {g.items.map((item) => (
                  <button key={item.label} type="button"
                    onClick={() => setTc({ tempo: g.cat, item })}
                    className="py-3 rounded-xl text-sm font-bold transition-all"
                    style={pill(tc?.item.label === item.label)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <p className="text-xs font-semibold t-muted uppercase tracking-wide">Renk</p>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_CHOICES.map((c) => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)}
                  className="py-3 rounded-xl text-sm font-bold transition-all"
                  style={pill(color === c.value)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={publish} disabled={!tc}
              className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: 'var(--t-accent)', color: '#fff' }}>
              ▶️ Teklifi Yayınla
            </button>
            {/* Teklif KALDIRMA burada degil, yukaridaki "Teklifin panoda"
                satirindadir — iki farkli yerde ayni is yapilmaz. */}
            <button type="button" onClick={() => { setFormOpen(false); setTc(null); }}
              className="t-btn-ghost px-4 py-3 text-sm">
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run tests/offer-board.test.tsx
```

Beklenen: PASS — 9 test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/play/OfferBoard.tsx apps/web/tests/offer-board.test.tsx
git commit -m "feat: OfferBoard teklif panosu bileseni"
```

---

## Task 8: `/play` entegrasyonu

**Files:**
- Modify: `apps/web/app/(child)/play/page.tsx:141-153` (`mode === 'friend'` dalı)
- Test: `apps/web/tests/friend-badge-usage.test.tsx` (mevcut mock'a EKLEME)

- [ ] **Step 1: Mevcut testi yeni bileşene uyarla**

`apps/web/tests/friend-badge-usage.test.tsx` içindeki `ChallengeScreen` mock'unun
**altına** şunu ekle (mevcut mock silinmez — `OpeningPractice` hâlâ kullanıyor):

```tsx
vi.mock('@/components/play/OfferBoard', () => ({
  OfferBoard: () => <div data-testid="offer-board" />,
}));
```

- [ ] **Step 2: Implementation**

`apps/web/app/(child)/play/page.tsx` içindeki import bloğuna ekle:

```tsx
import { OfferBoard } from '@/components/play/OfferBoard';
```

`ChallengeScreen` importunu **sil** (bu sayfada artık kullanılmıyor) ve
`mode === 'friend'` dalındaki `<ChallengeScreen ... />` satırını değiştir:

```tsx
        <OfferBoard
          onMatched={({ gameId, color }) => router.push(`/play/online/${gameId}?color=${color}`)}
        />
```

- [ ] **Step 3: Testleri çalıştır**

```bash
cd apps/web && npx vitest run tests/friend-badge-usage.test.tsx
```

Beklenen: PASS — 5 test (mevcut testler bozulmamalı).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(child\)/play/page.tsx apps/web/tests/friend-badge-usage.test.tsx
git commit -m "feat: Arkadasla Oyna artik teklif panosu acar"
```

---

## Task 9: Tam test kapısı

**Files:** yok (yalnızca doğrulama)

- [ ] **Step 1: Backend**

```bash
cd apps/api && python -m pytest -q
```

Beklenen: **291** test PASS (275 + 16).

- [ ] **Step 2: Migration başı tek mi**

```bash
cd apps/api && python -m alembic heads
```

Beklenen: tek bir head. (Bu projede yeni migration YOK; bu kontrol kazayla
migration eklenmediğini doğrular.)

- [ ] **Step 3: TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```

Beklenen: çıktı yok.

- [ ] **Step 4: Lint**

```bash
cd apps/web && npx next lint
```

Beklenen: 0 hata. (`lib/chess/boardSkin.tsx` içindeki `no-img-element` uyarısı
bu projeden ÖNCE de vardı; uyarı kabul, hata kabul değil.)

- [ ] **Step 5: Frontend testler**

```bash
cd apps/web && npx vitest run
```

Beklenen: **488** test PASS (472 + Task 5'ten 7 + Task 7'den 9).
Sayı tutmuyorsa DUR ve nedenini bul.

- [ ] **Step 6: Build**

```bash
cd apps/web && npm run build
```

Beklenen: `Compiled successfully`.

---

## Task 10: Canlı doğrulama (KURAL #6)

**Files:** geçici `apps/web/.env.local` (doğrulama sonunda **silinir**)

- [ ] **Step 1: Kullanıcıya sor ve SINIRI ÖNCEDEN SÖYLE**

Kullanıcıya sor: "Bunu canlı önizlemede test edeyim mi?" ve aynı mesajda şunu belirt:
**panonun tam akışı iki ayrı sporcu oturumu ister; tek tarayıcı oturumuyla "A teklif
bırakır, B alır" adımı doğrulanamaz.** Onay gelmeden Step 2'ye geçme.

- [ ] **Step 2: Prod API'ye bağlı dev sunucu**

`apps/web/.env.local` oluştur:

```
NEXT_PUBLIC_API_URL=https://chess-app-production-1dab.up.railway.app
```

`preview_start` aracıyla `{name: "chess-web"}` (mevcut `.claude/launch.json` girişi).
Bash ile dev sunucu ÇALIŞTIRMA.

- [ ] **Step 3: Panoya git**

`/play` → "Arkadaşla Oyna". `read_page` ile doğrula:
"Açık Teklifler (0)" ve "Şu an açık teklif yok..." metni görünmeli.

- [ ] **Step 4: Teklif formu**

"+ Maç Teklif Et"e bas. Tempo/süre düğmeleri ve renk düğmeleri görünmeli.
Süre seçmeden "Teklifi Yayınla"nın **soluk/pasif** olduğunu doğrula.

- [ ] **Step 5: Teklif yayınla**

Bir süre + renk seç, "Teklifi Yayınla"ya bas. `read_console_messages` ile hata
olmadığını, `read_page` ile pano sayısının **kendi teklifin hariç 0 kaldığını**
doğrula (sunucu kendi teklifini sana göstermez — beklenen davranış budur).

- [ ] **Step 6: Sunucuda gerçekten var mı**

`javascript_tool` ile WS trafiğine bakmak yerine daha basiti: sayfayı yenile.
`lobby_joined` yeniden gelir; teklif hâlâ sunucuda durduğu için pano yine
kendi teklifini gizler. Bu adım **kanıt değildir**, yalnızca çökme olmadığını gösterir —
raporda böyle yazılır.

- [ ] **Step 7: Regresyon**

`/play` → "Bota Karşı Oyna" kriter ekranının açıldığını, "Açılışı Pratiği Yap"
akordiyonunun (P11) hâlâ çalıştığını doğrula.

- [ ] **Step 8: Temizlik**

```bash
rm -f apps/web/.env.local
```

`preview_stop` ile sunucuyu durdur. `git status --short` ile `.env.local` kalmadığını doğrula.

- [ ] **Step 9: Dürüst rapor**

Şunlar **açıkça** yazılır: hangi adım doğrulandı, "iki sporcu" akışının
doğrulanamadığı, arkasında yalnızca otomatik testlerin olduğu. Doğrulanamayan hiçbir
şey için "çalışıyor" DENMEZ (KURAL #1).

---

## Task 11: Bitirme

- [ ] **Step 1: finishing-a-development-branch skill'ini çalıştır**

Testleri doğrula, seçenekleri sun, kullanıcının seçimini uygula. Depoda tek dal
(`main`) kullanılıyor; push kullanıcı onayıyla yapılır.
