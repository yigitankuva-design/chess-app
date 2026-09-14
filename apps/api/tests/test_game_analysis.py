# Madde 2026-09-14 (3b/4): "Analiz Et" özetini saklayan GameAnalysis —
# POST /games/{id}/analysis (upsert) + GET /games/{id}/analysis. Motor
# İSTEMCİDE çalışıyor, backend sadece SONUCU saklıyor.
import pytest
from chess_api.models import Game, GameType, GameStatus


async def _finished_bot_game(db, child_id: int) -> int:
    game = Game(type=GameType.bot, status=GameStatus.finished, white_child_id=child_id, black_bot_level=5)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    return game.id


def _payload(**overrides):
    body = {
        "inaccuracies": 2, "mistakes": 1, "blunders": 1,
        "acpl": 45, "accuracy": 78.5,
        "phase_accuracy_opening": 90.0, "phase_accuracy_middlegame": 70.0, "phase_accuracy_endgame": None,
        "mistake_moves": [
            {
                "ply": 7, "fen_before": "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
                "played_san": "Bc4", "best_move": "g1f3", "cp_loss": 120, "severity": "mistake",
            },
        ],
    }
    body.update(overrides)
    return body


@pytest.mark.asyncio
async def test_save_and_get_game_analysis(client, child_auth, db):
    token, child_id = child_auth
    game_id = await _finished_bot_game(db, child_id)
    auth = {"Authorization": f"Bearer {token}"}

    r = await client.post(f"/games/{game_id}/analysis", headers=auth, json=_payload())
    assert r.status_code == 200, r.text

    r = await client.get(f"/games/{game_id}/analysis", headers=auth)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["inaccuracies"] == 2
    assert data["mistakes"] == 1
    assert data["blunders"] == 1
    assert data["acpl"] == 45
    assert data["accuracy"] == 78.5
    assert data["phase_accuracy"] == {"opening": 90.0, "middlegame": 70.0, "endgame": None}
    assert len(data["mistake_moves"]) == 1
    assert data["mistake_moves"][0]["best_move"] == "g1f3"
    assert data["mistake_moves"][0]["severity"] == "mistake"


@pytest.mark.asyncio
async def test_get_game_analysis_hic_kaydedilmemisse_404(client, child_auth, db):
    token, child_id = child_auth
    game_id = await _finished_bot_game(db, child_id)
    r = await client.get(f"/games/{game_id}/analysis", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_ikinci_kez_kaydedince_uzerine_yazar_upsert(client, child_auth, db):
    token, child_id = child_auth
    game_id = await _finished_bot_game(db, child_id)
    auth = {"Authorization": f"Bearer {token}"}

    await client.post(f"/games/{game_id}/analysis", headers=auth, json=_payload())
    r = await client.post(f"/games/{game_id}/analysis", headers=auth, json=_payload(mistakes=9, accuracy=10.0))
    assert r.status_code == 200, r.text

    r = await client.get(f"/games/{game_id}/analysis", headers=auth)
    assert r.json()["mistakes"] == 9
    assert r.json()["accuracy"] == 10.0


@pytest.mark.asyncio
async def test_baskasinin_macina_kaydedemez_ve_okuyamaz(client, child_auth, db):
    from tests.test_notifications import _child_login, ch

    token, child_id = child_auth
    game_id = await _finished_bot_game(db, child_id)

    other_tok, _ = await _child_login(client, "ga_other@t.com")
    r = await client.post(f"/games/{game_id}/analysis", headers=ch(other_tok), json=_payload())
    assert r.status_code == 403
    r = await client.get(f"/games/{game_id}/analysis", headers=ch(other_tok))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_bos_mistake_moves_ile_de_kaydedilebilir(client, child_auth, db):
    """Sporcu hiç hata yapmadıysa — boş liste, sayılar 0."""
    token, child_id = child_auth
    game_id = await _finished_bot_game(db, child_id)
    auth = {"Authorization": f"Bearer {token}"}

    r = await client.post(f"/games/{game_id}/analysis", headers=auth, json=_payload(
        inaccuracies=0, mistakes=0, blunders=0, mistake_moves=[],
    ))
    assert r.status_code == 200, r.text

    r = await client.get(f"/games/{game_id}/analysis", headers=auth)
    assert r.json()["mistake_moves"] == []
