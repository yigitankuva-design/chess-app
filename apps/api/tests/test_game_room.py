import pytest
from chess_api.services.game_room import GameRoom


class FakeSender:
    """GameRoom'un bekledigi 'async send_json' arayuzunu taklit eder."""

    def __init__(self):
        self.messages = []

    async def send_json(self, data: dict) -> None:
        self.messages.append(data)


@pytest.mark.asyncio
async def test_ayni_sporcunun_iki_baglantisi_da_yayini_alir():
    """Bugunku kusur: ikinci join() birinciyi ANINDA sessizce siler.
    Ayni sporcu (child_id) ikinci cihazdan baglaninca, ilk cihaz koptu
    SANILIP hicbir yayin almamali degil — HER IKI cihaz da almali."""
    room = GameRoom(game_id=1)
    telefon, bilgisayar = FakeSender(), FakeSender()
    room.join(child_id=7, sender=telefon)
    room.join(child_id=7, sender=bilgisayar)  # AYNI child_id, ikinci baglanti

    await room.broadcast({"type": "move_made", "uci": "e2e4"})

    assert telefon.messages == [{"type": "move_made", "uci": "e2e4"}]
    assert bilgisayar.messages == [{"type": "move_made", "uci": "e2e4"}]


@pytest.mark.asyncio
async def test_bir_baglanti_kopunca_digeri_yayina_devam_eder():
    """Telefon sekmesi kapanir (leave), ama bilgisayar acik kalir — o
    hala yayin almaya devam etmeli."""
    room = GameRoom(game_id=1)
    telefon, bilgisayar = FakeSender(), FakeSender()
    telefon_conn = room.join(child_id=7, sender=telefon)
    room.join(child_id=7, sender=bilgisayar)

    room.leave(child_id=7, conn_id=telefon_conn)
    await room.broadcast({"type": "ping"})

    assert telefon.messages == []
    assert bilgisayar.messages == [{"type": "ping"}]


@pytest.mark.asyncio
async def test_son_baglanti_da_kopunca_sporcu_odadan_tamamen_cikar():
    room = GameRoom(game_id=1)
    tek = FakeSender()
    conn_id = room.join(child_id=7, sender=tek)

    room.leave(child_id=7, conn_id=conn_id)

    assert 7 not in room.players


@pytest.mark.asyncio
async def test_iki_farkli_sporcu_broadcast_ve_exclude_calisir():
    """Regresyon: insan-insan mactaki mevcut davranis (iki AYRI sporcu,
    exclude ile 'rakibe gonder') bozulmamali."""
    room = GameRoom(game_id=1)
    beyaz, siyah = FakeSender(), FakeSender()
    room.join(child_id=1, sender=beyaz)
    room.join(child_id=2, sender=siyah)

    await room.broadcast({"type": "x"}, exclude=1)

    assert beyaz.messages == []
    assert siyah.messages == [{"type": "x"}]


@pytest.mark.asyncio
async def test_send_to_sporcunun_tum_baglantilarina_gider():
    room = GameRoom(game_id=1)
    telefon, bilgisayar = FakeSender(), FakeSender()
    room.join(child_id=7, sender=telefon)
    room.join(child_id=7, sender=bilgisayar)

    await room.send_to(7, {"type": "error", "message": "not_your_turn"})

    assert telefon.messages == [{"type": "error", "message": "not_your_turn"}]
    assert bilgisayar.messages == [{"type": "error", "message": "not_your_turn"}]
