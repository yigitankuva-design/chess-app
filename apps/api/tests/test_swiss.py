from datetime import datetime, timedelta
import pytest
from sqlalchemy import select
from chess_api.models import (
    ChildProfile, Game, GameType, GameStatus, GameResult,
    Tournament, TournamentStatus, TournamentType, TournamentParticipant, TournamentPairing,
)
from chess_api.services.swiss import generate_round_pairings, advance_swiss_tournament, RoundPairing
from chess_api.services.tournaments import finalize_tournament_pairing


def _p(child_id: int, score: float = 0.0, bye_count: int = 0) -> TournamentParticipant:
    return TournamentParticipant(id=child_id, tournament_id=1, child_id=child_id, score=score, bye_count=bye_count)


def test_cift_sayida_katilimci_hepsi_eslesir_bay_olmaz():
    parts = [_p(1, 6), _p(2, 4), _p(3, 2), _p(4, 0)]
    pairings, bye = generate_round_pairings(parts, [])
    assert bye is None
    assert len(pairings) == 2
    paired_ids = {pr.white_child_id for pr in pairings} | {pr.black_child_id for pr in pairings}
    assert paired_ids == {1, 2, 3, 4}


def test_tek_sayida_katilimci_en_dusuk_puanli_bay_alir():
    parts = [_p(1, 6), _p(2, 4), _p(3, 2)]
    pairings, bye = generate_round_pairings(parts, [])
    assert bye == 3  # en düşük puanlı
    assert len(pairings) == 1
    assert {pairings[0].white_child_id, pairings[0].black_child_id} == {1, 2}


def test_daha_once_bay_almis_olan_tekrar_bay_almaz_esit_puanda():
    """Puanlar eşitse (round 1 gibi) daha önce bay almamış tercih edilir."""
    parts = [_p(1, 0), _p(2, 0), _p(3, 0, bye_count=1)]
    pairings, bye = generate_round_pairings(parts, [])
    assert bye in (1, 2)  # 3 daha önce bay almış, tercih edilmez
    assert bye != 3


def test_daha_once_oynamamis_rakiple_eslestirir():
    """1-2 daha önce oynamışsa, sıradaki turda mümkünse tekrar eşleşmezler."""
    parts = [_p(1, 2), _p(2, 2), _p(3, 0), _p(4, 0)]
    past = [TournamentPairing(tournament_id=1, white_child_id=1, black_child_id=2, result="1-0")]
    pairings, bye = generate_round_pairings(parts, past)
    assert bye is None
    paired_pairs = [{pr.white_child_id, pr.black_child_id} for pr in pairings]
    assert {1, 2} not in paired_pairs  # tekrar eşleşmediler


def test_herkesle_oynamissa_tekrara_izin_verilir():
    """Küçük turnuvada (2 kişi) tekrar eşleşme kaçınılmaz — reddedilmemeli."""
    parts = [_p(1, 2), _p(2, 0)]
    past = [TournamentPairing(tournament_id=1, white_child_id=1, black_child_id=2, result="1-0")]
    pairings, bye = generate_round_pairings(parts, past)
    assert bye is None
    assert len(pairings) == 1
    assert {pairings[0].white_child_id, pairings[0].black_child_id} == {1, 2}


class _SessionCtx:
    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        return self._db

    async def __aexit__(self, *exc):
        return False


async def _fake_create_game(db, white_id: int, black_id: int) -> int:
    game = Game(type=GameType.human, white_child_id=white_id, black_child_id=black_id, status=GameStatus.active)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    return game.id


@pytest.mark.asyncio
async def test_baslangic_zamani_gelince_1_tur_uretilir(db):
    t = Tournament(
        name="İsviçre Test", created_by_user_id=1, tournament_type=TournamentType.swiss,
        status=TournamentStatus.upcoming, starts_at=datetime.utcnow() - timedelta(minutes=1),
        rounds_total=3, current_round=0,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p1.id))
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p2.id))
    await db.commit()

    await advance_swiss_tournament(db, t, create_game=lambda w, b: _fake_create_game(db, w, b))

    assert t.status == TournamentStatus.active
    assert t.current_round == 1
    pairings = (await db.execute(
        select(TournamentPairing).where(TournamentPairing.tournament_id == t.id)
    )).scalars().all()
    assert len(pairings) == 1
    assert pairings[0].round_number == 1
    assert pairings[0].game_id is not None


@pytest.mark.asyncio
async def test_tur_bitmeden_sonraki_tura_gecilmez(db):
    t = Tournament(
        name="X", created_by_user_id=1, tournament_type=TournamentType.swiss,
        status=TournamentStatus.active, starts_at=datetime.utcnow(),
        rounds_total=3, current_round=1,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p1.id))
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p2.id))
    await db.commit()
    db.add(TournamentPairing(
        tournament_id=t.id, white_child_id=p1.id, black_child_id=p2.id,
        round_number=1, result=None,
    ))
    await db.commit()

    await advance_swiss_tournament(db, t, create_game=lambda w, b: _fake_create_game(db, w, b))
    assert t.current_round == 1  # değişmedi, tur hâlâ sürüyor


@pytest.mark.asyncio
async def test_son_turdan_sonra_turnuva_biter(db):
    t = Tournament(
        name="X", created_by_user_id=1, tournament_type=TournamentType.swiss,
        status=TournamentStatus.active, starts_at=datetime.utcnow(),
        rounds_total=1, current_round=1,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p1.id))
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p2.id))
    await db.commit()
    db.add(TournamentPairing(
        tournament_id=t.id, white_child_id=p1.id, black_child_id=p2.id,
        round_number=1, result="1-0",
    ))
    await db.commit()

    await advance_swiss_tournament(db, t, create_game=lambda w, b: _fake_create_game(db, w, b))
    assert t.status == TournamentStatus.finished


@pytest.mark.asyncio
async def test_bay_alan_otomatik_2_puan_kazanir(db):
    t = Tournament(
        name="X", created_by_user_id=1, tournament_type=TournamentType.swiss,
        status=TournamentStatus.upcoming, starts_at=datetime.utcnow() - timedelta(minutes=1),
        rounds_total=1, current_round=0,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    db.add(p1)
    await db.commit()
    await db.refresh(p1)
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p1.id))
    await db.commit()

    await advance_swiss_tournament(db, t, create_game=lambda w, b: _fake_create_game(db, w, b))

    part = (await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == t.id)
    )).scalar_one()
    assert part.score == 2.0
    assert part.bye_count == 1
    pairings = (await db.execute(
        select(TournamentPairing).where(TournamentPairing.tournament_id == t.id)
    )).scalars().all()
    assert pairings == []  # bay için eşleşme satırı oluşturulmaz


@pytest.mark.asyncio
async def test_void_esleme_de_tur_bitmis_sayilir(db):
    """Madde 2026-09-09(2/6) ile tutarlılık: iptal edilen (void) bir maç da
    "sonuçlanmış" sayılır — turu sonsuza dek asılı bırakmaz."""
    t = Tournament(
        name="X", created_by_user_id=1, tournament_type=TournamentType.swiss,
        status=TournamentStatus.active, starts_at=datetime.utcnow(),
        rounds_total=2, current_round=1,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p1.id))
    db.add(TournamentParticipant(tournament_id=t.id, child_id=p2.id))
    await db.commit()
    db.add(TournamentPairing(
        tournament_id=t.id, white_child_id=p1.id, black_child_id=p2.id,
        round_number=1, result="void",
    ))
    await db.commit()

    await advance_swiss_tournament(db, t, create_game=lambda w, b: _fake_create_game(db, w, b))
    assert t.current_round == 2
