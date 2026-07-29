"""Kuyruk eşleştirmesinde tempo (madde: /play/online süresiz maç açıyordu)."""
import asyncio
import pytest

from chess_api.services.matchmaking import find_match, _reset_for_tests


@pytest.mark.asyncio
async def test_ayni_tempo_eslesir_ve_saat_kurulur():
    _reset_for_tests()
    seen: dict = {}

    async def create_game(w, b, base_ms=None, increment_ms=0):
        seen.update(base_ms=base_ms, increment_ms=increment_ms)
        return 42

    first = asyncio.create_task(
        find_match(1, 800, create_game, wait_timeout=5.0, tc_base=300, tc_increment=3)
    )
    await asyncio.sleep(0.05)
    second = await find_match(2, 800, create_game, wait_timeout=5.0,
                              tc_base=300, tc_increment=3)
    t1 = await first

    assert t1.game_id == 42 and second.game_id == 42
    assert seen == {"base_ms": 300_000, "increment_ms": 3_000}


@pytest.mark.asyncio
async def test_farkli_tempo_ESLESMEZ():
    """TUZAK: 3+2 isteyen sporcu 30+0 isteyene bağlanmamalı."""
    _reset_for_tests()

    async def create_game(w, b, base_ms=None, increment_ms=0):
        raise AssertionError("eşleşmemeliydi")

    first = asyncio.create_task(
        find_match(1, 800, create_game, wait_timeout=0.3, tc_base=180, tc_increment=2)
    )
    await asyncio.sleep(0.05)
    second = await find_match(2, 800, create_game, wait_timeout=0.3,
                              tc_base=1800, tc_increment=0)
    t1 = await first

    assert t1.game_id is None
    assert second.game_id is None


@pytest.mark.asyncio
async def test_temposuz_eski_akis_bozulmaz():
    """REGRESYON: tempo verilmeyen çağrılar eskisi gibi eşleşir."""
    _reset_for_tests()

    async def create_game(w, b, base_ms=None, increment_ms=0):
        assert base_ms is None
        return 7

    first = asyncio.create_task(find_match(1, 800, create_game, wait_timeout=5.0))
    await asyncio.sleep(0.05)
    second = await find_match(2, 800, create_game, wait_timeout=5.0)
    t1 = await first

    assert t1.game_id == 7 and second.game_id == 7
