import pytest
from chess_api.services.lobby import (
    join_lobby, leave_lobby, online_players, send_to_player, _reset_for_tests,
)


class FakeSender:
    def __init__(self):
        self.messages = []

    async def send_json(self, data: dict) -> None:
        self.messages.append(data)


def setup_function():
    _reset_for_tests()


def test_baslangicta_kimse_online_degil():
    assert online_players() == []


def test_katilan_oyuncu_online_listesinde_gorunur():
    join_lobby(7, "Ali", FakeSender())
    assert online_players() == [{"child_id": 7, "display_name": "Ali"}]


def test_ayrilan_oyuncu_listeden_cikar():
    join_lobby(7, "Ali", FakeSender())
    leave_lobby(7)
    assert online_players() == []


def test_ayni_oyuncu_iki_kez_katilirsa_tek_kayit_kalir():
    join_lobby(7, "Ali", FakeSender())
    join_lobby(7, "Ali", FakeSender())
    assert len(online_players()) == 1


def test_online_listesi_kendini_haric_tutabilir():
    join_lobby(7, "Ali", FakeSender())
    join_lobby(8, "Veli", FakeSender())
    ids = [p["child_id"] for p in online_players(exclude=7)]
    assert ids == [8]


@pytest.mark.asyncio
async def test_belirli_oyuncuya_mesaj_gonderilir():
    ali, veli = FakeSender(), FakeSender()
    join_lobby(7, "Ali", ali)
    join_lobby(8, "Veli", veli)
    await send_to_player(8, {"type": "challenge_received", "from_child_id": 7})
    assert veli.messages == [{"type": "challenge_received", "from_child_id": 7}]
    assert ali.messages == []


@pytest.mark.asyncio
async def test_olmayan_oyuncuya_mesaj_sessizce_yok_sayilir():
    await send_to_player(999, {"type": "x"})  # patlamamali
