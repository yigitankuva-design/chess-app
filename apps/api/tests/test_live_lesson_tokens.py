"""live_lesson_tokens.py — LiveKit sunucu API çağrılarının hata sarmalama
mantığı. Madde 2026-09-15 (düzeltme): Zafer "Dersi Başlat"a basınca sadece
jenerik "Derse bağlanılamadı" görüyordu, gerçek sebep (yanlış LIVEKIT_URL,
erişilemeyen sunucu, geçersiz kimlik bilgisi vb.) Railway loglarına erişimimiz
olmadığı için görünmüyordu. Bu testler, gerçek istisnanın artık YUTULMADIĞINI
(loglanıp 502'ye eklendiğini) ve "katılımcı bulunamadı" (404) durumunun hâlâ
zararsız sayılıp False döndüğünü doğrular — gerçek bir LiveKit sunucusuna
bağlanmadan (`_client()` sahtelenir).
"""
import pytest
from fastapi import HTTPException
from livekit import api

from chess_api.services import live_lesson_tokens as lkt


class _FakeRoomService:
    def __init__(self, create_room_exc=None, get_participant_exc=None, get_participant_result=None):
        self._create_room_exc = create_room_exc
        self._get_participant_exc = get_participant_exc
        self._get_participant_result = get_participant_result

    async def create_room(self, *_a, **_kw):
        if self._create_room_exc:
            raise self._create_room_exc

    async def get_participant(self, *_a, **_kw):
        if self._get_participant_exc:
            raise self._get_participant_exc
        return self._get_participant_result

    async def mute_published_track(self, *_a, **_kw):
        return None


class _FakeClient:
    def __init__(self, room):
        self.room = room

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc):
        return False


def _patch_client(monkeypatch, room):
    monkeypatch.setattr(lkt, "_client", lambda: _FakeClient(room))


@pytest.mark.asyncio
async def test_ensure_room_baglanti_hatasinda_502_ve_gercek_detay_icerir(monkeypatch):
    _patch_client(monkeypatch, _FakeRoomService(create_room_exc=ConnectionError("Connection refused")))

    with pytest.raises(HTTPException) as exc_info:
        await lkt.ensure_room(42)

    assert exc_info.value.status_code == 502
    assert "ConnectionError" in exc_info.value.detail
    assert "Connection refused" in exc_info.value.detail


@pytest.mark.asyncio
async def test_ensure_room_server_error_de_502ye_sarilir(monkeypatch):
    """401/403 gibi kimlik doğrulama hataları da (yanlış API key/secret)
    aynı şekilde görünür hale gelmeli."""
    server_err = api.ServerError("unauthenticated", "invalid api key", status=401)
    _patch_client(monkeypatch, _FakeRoomService(create_room_exc=server_err))

    with pytest.raises(HTTPException) as exc_info:
        await lkt.ensure_room(42)

    assert exc_info.value.status_code == 502
    assert "invalid api key" in exc_info.value.detail


@pytest.mark.asyncio
async def test_mute_katilimci_bulunamazsa_404_zararsiz_sayilir_false_doner(monkeypatch):
    not_found = api.ServerError("not_found", "participant not found", status=404)
    _patch_client(monkeypatch, _FakeRoomService(get_participant_exc=not_found))

    result = await lkt.mute_child_microphone(42, 7)
    assert result is False


@pytest.mark.asyncio
async def test_mute_baglanti_hatasi_404_degilse_502ye_sarilir(monkeypatch):
    """404 DIŞINDA bir ServerError (örn. sunucu tarafı 500) 'zararsız'
    sayılmamalı — gerçek bir bağlantı/sunucu sorunu olarak yükselmeli."""
    server_err = api.ServerError("internal", "boom", status=500)
    _patch_client(monkeypatch, _FakeRoomService(get_participant_exc=server_err))

    with pytest.raises(HTTPException) as exc_info:
        await lkt.mute_child_microphone(42, 7)
    assert exc_info.value.status_code == 502
