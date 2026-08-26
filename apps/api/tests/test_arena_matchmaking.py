import asyncio
from chess_api.services.arena_matchmaking import find_arena_opponent, leave_arena_queue, _reset_for_tests


def setup_function(_):
    _reset_for_tests()


def teardown_function(_):
    _reset_for_tests()


async def _fake_create_game(white_id, black_id):
    return 999  # fake game id


async def test_tek_sporcu_bekler_sonra_zaman_asimina_ugrar():
    ticket = await find_arena_opponent(
        tournament_id=1, child_id=1, score=0.0, create_game=_fake_create_game, wait_timeout=0.2,
    )
    assert ticket.game_id is None


async def test_iki_sporcu_eslesir_tolerans_yok():
    """matchmaking.py'nin aksine RATING_TOLERANCE gibi bir sinir yok — puan
    farki ne olursa olsun bekleyen biri varsa eslestirilir (Lichess: kimse
    bosta kalmasin)."""
    async def sporcu1():
        return await find_arena_opponent(1, 1, score=0.0, create_game=_fake_create_game, wait_timeout=2.0)

    async def sporcu2():
        await asyncio.sleep(0.1)
        return await find_arena_opponent(1, 2, score=50.0, create_game=_fake_create_game, wait_timeout=2.0)

    t1, t2 = await asyncio.gather(sporcu1(), sporcu2())
    assert t1.game_id == 999
    assert t2.game_id == 999
    assert {t1.color, t2.color} == {"white", "black"}
    assert t1.opponent_id == 2
    assert t2.opponent_id == 1


async def test_en_yakin_puanli_rakiple_eslesir():
    """Kuyrukta birden fazla bekleyen varsa PUANA EN YAKIN olanla eslesir —
    ilk giren degil.

    NOT: bunu es zamanli asyncio.gather ile KURAMAYIZ — tolerans olmadigi
    icin 2. kisi kuyruga girer girmez 1.'yle ANINDA eslesir (kilit ile
    seri-lestirilmis islemler), yani kuyrukta ayni anda 1'den fazla kisi
    biriktirmek asyncio zamanlamasiyla imkansiz. Bu yuzden secim mantigini
    (en yakin skor) DOGRUDAN, kuyrugu elle doldurarak test ediyoruz."""
    from chess_api.services import arena_matchmaking as am

    t1 = am.ArenaTicket(tournament_id=2, child_id=1, score=0.0)
    t2 = am.ArenaTicket(tournament_id=2, child_id=2, score=20.0)
    t3 = am.ArenaTicket(tournament_id=2, child_id=3, score=9.0)
    am._waiting[2] = [t1, t2, t3]

    newcomer = await find_arena_opponent(2, 99, score=10.0, create_game=_fake_create_game, wait_timeout=1.0)

    assert newcomer.game_id == 999
    assert newcomer.opponent_id == 3   # skor 9.0, 10.0'a en yakin
    assert t3.game_id == 999
    assert t3.opponent_id == 99
    assert t1.game_id is None and t2.game_id is None
    assert am._waiting[2] == [t1, t2]


async def test_farkli_turnuvalar_birbirini_etkilemez():
    """tournament_id anahtar oldugu icin, farkli turnuvalardaki bekleyenler
    birbirleriyle ASLA eslesmez."""
    t1 = await find_arena_opponent(10, 1, score=0.0, create_game=_fake_create_game, wait_timeout=0.2)
    t2 = await find_arena_opponent(20, 2, score=0.0, create_game=_fake_create_game, wait_timeout=0.2)
    assert t1.game_id is None
    assert t2.game_id is None


async def test_kuyruktan_ayrilma():
    async def sporcu1():
        return await find_arena_opponent(3, 1, score=0.0, create_game=_fake_create_game, wait_timeout=1.0)

    task = asyncio.create_task(sporcu1())
    await asyncio.sleep(0.1)
    await leave_arena_queue(3, 1)
    t1 = await task
    assert t1.game_id is None
