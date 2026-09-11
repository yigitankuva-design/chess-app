# Madde 2026-09-11 (Görsel Turu Aşama C / Madde 4, 5, 8): profil sayfasının
# Performans Puanı / Genel Maç İstatistikleri / Turnuva Geçmişi kartları.
# Kaynak kuralı (S1/S2): puanlı arkadaş + turnuva maçları; bot ve puansız
# arkadaş maçları HİÇBİR istatistiğe girmez.
import pytest
from datetime import datetime, timedelta
from chess_api.models import (
    ChildProfile, Game, GameType, GameStatus, GameResult, Tournament, TournamentStatus,
    TournamentType, TournamentParticipant, TournamentPairing,
)
from chess_api.services.rating import apply_rating_update, STARTING_RATING
from chess_api.services.profile_stats import compute_match_stats
from tests.test_notifications import _child_login, ch
from tests.test_homework import _teacher2, auth


async def _two(db):
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2]); await db.commit(); await db.refresh(p1); await db.refresh(p2)
    return p1, p2


async def _human(db, white, black, result, *, rated=True, base_ms=300_000, inc_ms=0,
                 finished_at=None, apply_rating=True):
    g = Game(type=GameType.human, status=GameStatus.finished, result=result,
             white_child_id=white.id, black_child_id=black.id, base_ms=base_ms, increment_ms=inc_ms,
             rated=rated, finished_at=finished_at or datetime.utcnow())
    db.add(g); await db.commit(); await db.refresh(g)
    if apply_rating:
        await apply_rating_update(db, g); await db.commit()
    return g


@pytest.mark.asyncio
async def test_veri_yoksa_sifirlar(db):
    p1, _ = await _two(db)
    s = await compute_match_stats(db, p1.id)
    assert set(s) == {"Yıldırım", "Hızlı", "Klasik"}
    y = s["Yıldırım"]
    assert y["rating"] == {"value": STARTING_RATING, "games_played": 0, "provisional_games": 20,
                           "weekly_delta": 0, "history": []}
    assert y["stats"]["total"] == 0 and y["stats"]["win_rate"] is None
    assert y["tournaments"]["total"] == 0 and y["tournaments"]["first"] == 0


@pytest.mark.asyncio
async def test_puanli_maclar_sayilir_bot_ve_puansiz_sayilmaz(db):
    p1, p2 = await _two(db)
    now = datetime.utcnow()
    # 3 puanlı Yıldırım maçı: G, G, B (seri 2)
    await _human(db, p1, p2, GameResult.white_wins, finished_at=now - timedelta(days=3))
    await _human(db, p2, p1, GameResult.black_wins, finished_at=now - timedelta(days=2))
    await _human(db, p1, p2, GameResult.draw, finished_at=now - timedelta(days=1))
    # puansız arkadaş maçı → sayılmaz
    await _human(db, p1, p2, GameResult.white_wins, rated=False, apply_rating=False)
    # bot maçı → sayılmaz
    db.add(Game(type=GameType.bot, status=GameStatus.finished, result=GameResult.white_wins,
                white_child_id=p1.id, black_bot_level=1, base_ms=300_000, increment_ms=0, student_color="w"))
    # eşleşmeyen tempo (4+0) → sayılmaz
    await _human(db, p1, p2, GameResult.white_wins, base_ms=240_000)
    await db.commit()

    s = await compute_match_stats(db, p1.id)
    st = s["Yıldırım"]["stats"]
    assert (st["total"], st["wins"], st["draws"], st["losses"]) == (3, 2, 1, 0)
    assert st["win_rate"] == 67
    assert st["longest_win_streak"] == 2
    # En güçlü galibiyet: yenilen rakibin maç ÖNCESİ puanı (2. maçta p2 380'di).
    assert st["best_win_rating"] == 400
    r = s["Yıldırım"]["rating"]
    assert r["games_played"] == 3
    assert len(r["history"]) == 3 and r["history"][-1] == r["value"]
    # Bu hafta: ilk maç 7 gün içinde → başlangıç 400'den fark.
    assert r["weekly_delta"] == r["value"] - STARTING_RATING
    assert s["Hızlı"]["stats"]["total"] == 0


@pytest.mark.asyncio
async def test_haftalik_fark_sadece_son_7_gun(db):
    p1, p2 = await _two(db)
    now = datetime.utcnow()
    await _human(db, p1, p2, GameResult.white_wins, finished_at=now - timedelta(days=20))  # 420
    await _human(db, p1, p2, GameResult.white_wins, finished_at=now - timedelta(days=2))   # 420 → ?
    s = await compute_match_stats(db, p1.id)
    r = s["Yıldırım"]["rating"]
    assert r["weekly_delta"] == r["value"] - 420  # 7 gün önceki puan 420'ydi

    # Hiç maç yoksa bu hafta → 0
    p3, p4 = await _two(db)
    await _human(db, p3, p4, GameResult.white_wins, finished_at=now - timedelta(days=30))
    assert (await compute_match_stats(db, p3.id))["Yıldırım"]["rating"]["weekly_delta"] == 0


@pytest.mark.asyncio
async def test_gecmis_son_10_mac(db):
    p1, p2 = await _two(db)
    for i in range(12):
        await _human(db, p1, p2, GameResult.white_wins, finished_at=datetime.utcnow() - timedelta(hours=12 - i))
    r = (await compute_match_stats(db, p1.id))["Yıldırım"]["rating"]
    assert len(r["history"]) == 10
    assert r["history"] == sorted(r["history"])  # hep kazandı → artan


@pytest.mark.asyncio
async def test_turnuva_gecmisi_gby_podyum_bay_ve_cekilen(db):
    p1, p2 = await _two(db)
    p3 = ChildProfile(parent_user_id=1, display_name="C", age=9, pin_hash="x")
    db.add(p3); await db.commit(); await db.refresh(p3)

    t = Tournament(name="T1", created_by_user_id=1, base_ms=600_000, increment_ms=0, rated=False,
                   status=TournamentStatus.finished, tournament_type=TournamentType.swiss,
                   starts_at=datetime.utcnow())
    db.add(t); await db.commit(); await db.refresh(t)
    # p1: 2 puan (1 galibiyet + 1 bay), p2: 1 (galibiyet), p3: çekildi ama 1.5 puan
    parts = [
        TournamentParticipant(tournament_id=t.id, child_id=p1.id, score=2.0, bye_count=1),
        TournamentParticipant(tournament_id=t.id, child_id=p2.id, score=1.0),
        TournamentParticipant(tournament_id=t.id, child_id=p3.id, score=1.5, left_at=datetime.utcnow()),
    ]
    db.add_all(parts); await db.commit()
    # Puansız turnuva maçları — yine de istatistiğe girer (turnuva maçı).
    g1 = await _human(db, p1, p2, GameResult.white_wins, rated=False, base_ms=600_000, apply_rating=False)
    g2 = await _human(db, p2, p3, GameResult.white_wins, rated=False, base_ms=600_000, apply_rating=False)
    g3 = await _human(db, p3, p1, GameResult.draw, rated=False, base_ms=600_000, apply_rating=False)
    db.add_all([
        TournamentPairing(tournament_id=t.id, white_child_id=p1.id, black_child_id=p2.id, game_id=g1.id, result="1-0", round_number=1),
        TournamentPairing(tournament_id=t.id, white_child_id=p2.id, black_child_id=p3.id, game_id=g2.id, result="1-0", round_number=2),
        TournamentPairing(tournament_id=t.id, white_child_id=p3.id, black_child_id=p1.id, game_id=g3.id, result="1/2-1/2", round_number=3),
        # iptal edilen eşleşme → sayılmaz
        TournamentPairing(tournament_id=t.id, white_child_id=p1.id, black_child_id=p2.id, game_id=None, result="void", round_number=4),
    ])
    await db.commit()

    s1 = (await compute_match_stats(db, p1.id))["Hızlı"]
    tr = s1["tournaments"]
    assert tr["total"] == 1
    assert (tr["games"], tr["wins"], tr["draws"], tr["losses"]) == (2, 1, 1, 0)  # bay + void yok
    assert (tr["win_rate"], tr["draw_rate"], tr["loss_rate"]) == (50, 50, 0)
    assert (tr["first"], tr["second"], tr["third"]) == (1, 0, 0)
    # Turnuva maçları (puansız da olsa) Genel Maç İstatistikleri'ne girer.
    assert s1["stats"]["total"] == 2 and s1["stats"]["wins"] == 1
    # Puan geçmişi yok (puansız → anlık görüntü yazılmadı), puan 400 kaldı.
    assert s1["rating"]["history"] == [] and s1["rating"]["value"] == STARTING_RATING

    # p2: 2. sırada (çekilen p3 podyuma girmez).
    assert (await compute_match_stats(db, p2.id))["Hızlı"]["tournaments"]["second"] == 1
    # p3: çekildi → turnuva sayılır ama podyum yok.
    s3 = (await compute_match_stats(db, p3.id))["Hızlı"]["tournaments"]
    assert s3["total"] == 1 and (s3["first"], s3["second"], s3["third"]) == (0, 0, 0)
    # Bitmemiş turnuva sayılmaz.
    t2 = Tournament(name="T2", created_by_user_id=1, base_ms=600_000, increment_ms=0,
                    status=TournamentStatus.active, tournament_type=TournamentType.arena,
                    starts_at=datetime.utcnow())
    db.add(t2); await db.commit(); await db.refresh(t2)
    db.add(TournamentParticipant(tournament_id=t2.id, child_id=p1.id, score=0.0)); await db.commit()
    assert (await compute_match_stats(db, p1.id))["Hızlı"]["tournaments"]["total"] == 1


@pytest.mark.asyncio
async def test_uclar_sporcu_ve_antrenor(client, db):
    tok, teacher_id = await _teacher2(client, "ps1@t.com")
    t1, c1 = await _child_login(client, "ps1a@t.com")
    t2, c2 = await _child_login(client, "ps1b@t.com")
    for cid in (c1, c2):
        child = await db.get(ChildProfile, cid)
        child.teacher_user_id = teacher_id
    await db.commit()
    a = await db.get(ChildProfile, c1); b = await db.get(ChildProfile, c2)
    await _human(db, a, b, GameResult.white_wins)

    r = await client.get("/gamification/me/match-stats", headers=ch(t1))
    assert r.status_code == 200, r.text
    assert r.json()["Yıldırım"]["stats"]["wins"] == 1

    # Antrenör kendi öğrencisini görür, başkasınınkini göremez.
    r = await client.get(f"/teacher/students/{c1}/match-stats", headers=auth(tok))
    assert r.status_code == 200 and r.json()["Yıldırım"]["stats"]["wins"] == 1
    tok2, _ = await _teacher2(client, "ps2@t.com")
    assert (await client.get(f"/teacher/students/{c1}/match-stats", headers=auth(tok2))).status_code == 403

    # Antrenör kendi oyun profiliyle (hibrit jeton) aynı ucu kullanır — boş veri sıfır.
    r = await client.get("/gamification/me/match-stats", headers=auth(tok))
    assert r.status_code == 200 and r.json()["Yıldırım"]["stats"]["total"] == 0
