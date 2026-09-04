from chess_api.services.game_validation import validate_move


# --- Pure validation unit tests ---

INITIAL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def test_validate_legal_move():
    res = validate_move(INITIAL, "e2e4")
    assert res is not None
    assert res["san"] == "e4"
    assert res["is_game_over"] is False


def test_validate_illegal_move():
    assert validate_move(INITIAL, "e2e5") is None


def test_validate_detects_checkmate():
    # Fool's mate position: after 1.f3 e5 2.g4 Qh4#
    fen = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"
    res = validate_move(fen, "d8h4")
    assert res is not None
    assert res["is_checkmate"] is True
    assert res["is_game_over"] is True


# --- Endpoint tests ---

async def test_start_bot_game_requires_child_token(client):
    """A request with no token should be rejected."""
    response = await client.post("/games/bot/start", json={"skill_level": 5})
    assert response.status_code in (401, 403)


async def test_parent_token_rejected_on_games(client):
    """A parent token must be rejected with 401 (child token required)."""
    r = await client.post("/auth/parent/signup", json={
        "email": "gameparent@test.com", "password": "guvenliSifre1", "name": "GameParent",
    })
    parent_token = r.json()["access_token"]
    response = await client.post(
        "/games/bot/start",
        headers={"Authorization": f"Bearer {parent_token}"},
        json={"skill_level": 5},
    )
    assert response.status_code == 401


async def test_start_bot_game(client, child_auth):
    token, child_id = child_auth
    response = await client.post(
        "/games/bot/start",
        headers={"Authorization": f"Bearer {token}"},
        json={"skill_level": 5},
    )
    assert response.status_code == 200
    data = response.json()
    assert "game_id" in data
    assert data["your_color"] == "white"
    assert data["fen"] == INITIAL


async def test_start_bot_game_invalid_skill(client, child_auth):
    token, child_id = child_auth
    response = await client.post(
        "/games/bot/start",
        headers={"Authorization": f"Bearer {token}"},
        json={"skill_level": 50},
    )
    assert response.status_code == 422


async def test_make_legal_move(client, child_auth):
    token, child_id = child_auth
    start = await client.post("/games/bot/start",
                              headers={"Authorization": f"Bearer {token}"},
                              json={"skill_level": 3})
    gid = start.json()["game_id"]
    response = await client.post(
        f"/games/{gid}/move",
        headers={"Authorization": f"Bearer {token}"},
        json={"move_uci": "e2e4"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["accepted"] is True
    assert "fen_after" in data


async def test_make_illegal_move_rejected(client, child_auth):
    token, child_id = child_auth
    start = await client.post("/games/bot/start",
                              headers={"Authorization": f"Bearer {token}"},
                              json={"skill_level": 3})
    gid = start.json()["game_id"]
    response = await client.post(
        f"/games/{gid}/move",
        headers={"Authorization": f"Bearer {token}"},
        json={"move_uci": "e2e5"},
    )
    assert response.status_code == 200
    assert response.json()["accepted"] is False


async def test_start_bot_game_renk_start_fen_tempo_kaydedilir(client, child_auth, db):
    from sqlalchemy import select
    from chess_api.models import Game

    token, child_id = child_auth
    acilis_fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    response = await client.post(
        "/games/bot/start",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "skill_level": 5,
            "student_color": "b",
            "start_fen": acilis_fen,
            "tc_base_seconds": 300,
            "tc_increment_seconds": 2,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["your_color"] == "black"
    assert data["fen"] == acilis_fen

    gid = data["game_id"]
    game = (await db.execute(select(Game).where(Game.id == gid))).scalar_one()
    assert game.student_color == "b"
    assert game.start_fen == acilis_fen
    assert game.base_ms == 300_000
    assert game.increment_ms == 2_000
    assert game.white_ms == 300_000
    assert game.black_ms == 300_000
    # Rozet uyumlulugu: white_child_id/black_bot_level DEGISMEMELI.
    assert game.white_child_id == child_id
    assert game.black_bot_level == 5


async def test_start_bot_game_eski_istemci_hicbir_yeni_alan_gondermez(client, child_auth, db):
    """Geriye uyumluluk: eski istemci yalnizca skill_level gonderir."""
    from sqlalchemy import select
    from chess_api.models import Game

    token, child_id = child_auth
    response = await client.post(
        "/games/bot/start",
        headers={"Authorization": f"Bearer {token}"},
        json={"skill_level": 5},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["your_color"] == "white"

    gid = data["game_id"]
    game = (await db.execute(select(Game).where(Game.id == gid))).scalar_one()
    assert game.student_color == "w"
    assert game.start_fen is None
    assert game.base_ms is None


async def _ikinci_cocuk(client, email="analiz-rakip@t.com", display_name="Zeynep"):
    """Analiz Et testleri icin, giris yapmadan sadece id/isim gereken ikinci bir cocuk."""
    r = await client.post("/auth/parent/signup", json={
        "email": email, "password": "guvenli12345", "name": "Parent2",
    })
    parent_token = r.json()["access_token"]
    r = await client.post("/children", headers={"Authorization": f"Bearer {parent_token}"},
                          json={"display_name": display_name, "age": 9, "pin": "5678"})
    return r.json()["id"], display_name


async def test_list_my_games_bos_liste_dondurur(client, child_auth):
    token, _ = child_auth
    response = await client.get("/games", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == []


async def test_list_my_games_sadece_bitmis_maclari_dondurur(client, child_auth, db):
    from chess_api.models import Game, GameType, GameStatus, GameResult

    token, child_id = child_auth
    db.add(Game(type=GameType.bot, status=GameStatus.active,
                white_child_id=child_id, black_bot_level=3))
    finished = Game(type=GameType.bot, status=GameStatus.finished, result=GameResult.white_wins,
                     white_child_id=child_id, black_bot_level=3)
    db.add(finished)
    await db.commit()

    response = await client.get("/games", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["result"] == "1-0"


async def test_list_my_games_baska_cocugun_maci_sizmaz(client, child_auth, db):
    from chess_api.models import Game, GameType, GameStatus, GameResult

    token, _ = child_auth
    other_id, _ = await _ikinci_cocuk(client)
    db.add(Game(type=GameType.bot, status=GameStatus.finished, result=GameResult.draw,
                white_child_id=other_id, black_bot_level=3))
    await db.commit()

    response = await client.get("/games", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == []


async def test_list_my_games_bot_rakip_bilgisi(client, child_auth, db):
    from chess_api.models import Game, GameType, GameStatus, GameResult

    token, child_id = child_auth
    db.add(Game(type=GameType.bot, status=GameStatus.finished, result=GameResult.black_wins,
                white_child_id=child_id, black_bot_level=7))
    await db.commit()

    response = await client.get("/games", headers={"Authorization": f"Bearer {token}"})
    opponent = response.json()[0]["opponent"]
    assert opponent == {"type": "bot", "level": 7}


async def test_list_my_games_insan_rakip_bilgisi(client, child_auth, db):
    from chess_api.models import Game, GameType, GameStatus, GameResult

    token, child_id = child_auth
    other_id, other_name = await _ikinci_cocuk(client)
    db.add(Game(type=GameType.human, status=GameStatus.finished, result=GameResult.draw,
                white_child_id=child_id, black_child_id=other_id))
    await db.commit()

    response = await client.get("/games", headers={"Authorization": f"Bearer {token}"})
    opponent = response.json()[0]["opponent"]
    assert opponent == {"type": "human", "name": other_name}


async def test_list_my_games_acilis_pratigi_start_fen_dondurur(client, child_auth, db):
    from chess_api.models import Game, GameType, GameStatus, GameResult

    token, child_id = child_auth
    acilis_fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    db.add(Game(type=GameType.bot, status=GameStatus.finished, result=GameResult.draw,
                white_child_id=child_id, black_bot_level=3, start_fen=acilis_fen))
    await db.commit()

    response = await client.get("/games", headers={"Authorization": f"Bearer {token}"})
    assert response.json()[0]["start_fen"] == acilis_fen


async def test_list_my_games_standart_baslangicta_start_fen_null_doner(client, child_auth, db):
    from chess_api.models import Game, GameType, GameStatus, GameResult

    token, child_id = child_auth
    db.add(Game(type=GameType.bot, status=GameStatus.finished, result=GameResult.draw,
                white_child_id=child_id, black_bot_level=3))
    await db.commit()

    response = await client.get("/games", headers={"Authorization": f"Bearer {token}"})
    assert response.json()[0]["start_fen"] is None


async def test_list_my_games_bot_macinda_isimler_ve_puan_null(client, child_auth, db):
    """Madde 2026-09-06 (8): bot maçında white_name sporcunun kendi ismi,
    black_name "Bot · Düzey N" — bot maçları asla puanlı olmadığı için
    rating_delta alanları NULL kalır."""
    from chess_api.models import Game, GameType, GameStatus, GameResult

    token, child_id = child_auth
    db.add(Game(type=GameType.bot, status=GameStatus.finished, result=GameResult.white_wins,
                white_child_id=child_id, black_bot_level=7))
    await db.commit()

    response = await client.get("/games", headers={"Authorization": f"Bearer {token}"})
    g = response.json()[0]
    assert g["white_name"] == "Ali"
    assert g["black_name"] == "Bot · Düzey 7"
    assert g["rated"] is False
    assert g["white_rating_delta"] is None
    assert g["black_rating_delta"] is None
    assert g["tempo_label"] is None
    assert g["opening_name"] is None
    assert g["variant_name"] is None


async def test_list_my_games_insan_macinda_her_iki_isim_ve_tempo_etiketi(client, child_auth, db):
    from chess_api.models import Game, GameType, GameStatus, GameResult

    token, child_id = child_auth
    other_id, other_name = await _ikinci_cocuk(client)
    db.add(Game(type=GameType.human, status=GameStatus.finished, result=GameResult.white_wins,
                white_child_id=child_id, black_child_id=other_id,
                base_ms=300_000, increment_ms=3_000, rated=True,
                white_rating_before=400, white_rating_after=420,
                black_rating_before=400, black_rating_after=380))
    await db.commit()

    response = await client.get("/games", headers={"Authorization": f"Bearer {token}"})
    g = response.json()[0]
    assert g["white_name"] == "Ali"
    assert g["black_name"] == other_name
    assert g["rated"] is True
    assert g["white_rating_after"] == 420
    assert g["black_rating_after"] == 380
    assert g["white_rating_delta"] == 20
    assert g["black_rating_delta"] == -20
    assert g["tempo_label"] == "5+3(Yıldırım)"


async def test_list_my_games_puansiz_insan_macinda_rating_delta_null(client, child_auth, db):
    from chess_api.models import Game, GameType, GameStatus, GameResult

    token, child_id = child_auth
    other_id, _ = await _ikinci_cocuk(client)
    db.add(Game(type=GameType.human, status=GameStatus.finished, result=GameResult.draw,
                white_child_id=child_id, black_child_id=other_id, rated=False))
    await db.commit()

    response = await client.get("/games", headers={"Authorization": f"Bearer {token}"})
    g = response.json()[0]
    assert g["white_rating_delta"] is None
    assert g["black_rating_delta"] is None
    assert g["tempo_label"] is None


async def test_list_my_games_acilis_pratigi_varyantiyla_eslesince_isim_doner(client, child_auth, db):
    from chess_api.models import Game, GameType, GameStatus, GameResult, Opening, OpeningType, OpeningVariant

    token, child_id = child_auth
    fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    otype = OpeningType(name="e4'lü Açılışlar")
    db.add(otype)
    await db.commit()
    await db.refresh(otype)
    opening = Opening(name="İspanyol Açılışı", opening_type_id=otype.id)
    db.add(opening)
    await db.commit()
    await db.refresh(opening)
    db.add(OpeningVariant(opening_id=opening.id, name="Berlin Defansı", start_fen=fen))
    db.add(Game(type=GameType.bot, status=GameStatus.finished, result=GameResult.draw,
                white_child_id=child_id, black_bot_level=3, start_fen=fen))
    await db.commit()

    response = await client.get("/games", headers={"Authorization": f"Bearer {token}"})
    g = response.json()[0]
    assert g["opening_name"] == "İspanyol Açılışı"
    assert g["variant_name"] == "Berlin Defansı"


async def test_list_my_games_eslesmeyen_start_fen_acilis_ismi_dondurmez(client, child_auth, db):
    """Serbest/sıfırdan oynanan bir maçın start_fen'i (varsa) hiçbir
    OpeningVariant'a eşleşmiyorsa açılış/varyant ismi gösterilmez (madde
    2026-09-06 (8): onaylanan kapsam sınırı — tam ECO tanıma kapsam dışı)."""
    from chess_api.models import Game, GameType, GameStatus, GameResult

    token, child_id = child_auth
    db.add(Game(type=GameType.bot, status=GameStatus.finished, result=GameResult.draw,
                white_child_id=child_id, black_bot_level=3,
                start_fen="rnbqkbnr/pppppppp/8/8/8/4N3/PPPPPPPP/RNBQKB1R b KQkq - 1 1"))
    await db.commit()

    response = await client.get("/games", headers={"Authorization": f"Bearer {token}"})
    g = response.json()[0]
    assert g["opening_name"] is None
    assert g["variant_name"] is None


async def test_list_my_games_en_yeniden_eskiye_siralanir(client, child_auth, db):
    from datetime import datetime, timedelta
    from chess_api.models import Game, GameType, GameStatus, GameResult

    token, child_id = child_auth
    eski = Game(type=GameType.bot, status=GameStatus.finished, result=GameResult.draw,
                white_child_id=child_id, black_bot_level=1,
                started_at=datetime.utcnow() - timedelta(days=2))
    yeni = Game(type=GameType.bot, status=GameStatus.finished, result=GameResult.draw,
                white_child_id=child_id, black_bot_level=1,
                started_at=datetime.utcnow())
    db.add_all([eski, yeni])
    await db.commit()
    await db.refresh(eski)
    await db.refresh(yeni)

    response = await client.get("/games", headers={"Authorization": f"Bearer {token}"})
    data = response.json()
    assert [g["id"] for g in data] == [yeni.id, eski.id]


async def test_game_moves_sirali_liste_doner(client, child_auth, db):
    from chess_api.models import Game, GameMove, GameType, GameStatus

    token, child_id = child_auth
    game = Game(type=GameType.bot, status=GameStatus.finished, white_child_id=child_id, black_bot_level=3)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    db.add_all([
        GameMove(game_id=game.id, ply=2, san="e5", fen_after="fen2"),
        GameMove(game_id=game.id, ply=1, san="e4", fen_after="fen1"),
    ])
    await db.commit()

    response = await client.get(f"/games/{game.id}/moves", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == [
        {"ply": 1, "san": "e4", "fen_after": "fen1"},
        {"ply": 2, "san": "e5", "fen_after": "fen2"},
    ]


async def test_game_moves_baska_cocugun_maci_403(client, child_auth, db):
    from chess_api.models import Game, GameType, GameStatus

    token, _ = child_auth
    other_id, _ = await _ikinci_cocuk(client)
    game = Game(type=GameType.bot, status=GameStatus.finished, white_child_id=other_id, black_bot_level=3)
    db.add(game)
    await db.commit()
    await db.refresh(game)

    response = await client.get(f"/games/{game.id}/moves", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


async def test_game_moves_olmayan_mac_404(client, child_auth):
    token, _ = child_auth
    response = await client.get("/games/999999/moves", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404


async def test_acilis_pratiginden_baslayan_bot_macinda_ilk_hamle_dogru_degerlendirilir(client, child_auth):
    """Standart baslangicta yasak ama bu acilis pozisyonunda GECERLI bir
    hamle: 1.e4'ten sonra siyahin e7e5 oynamasi. games.py::_current_fen
    start_fen'i yok sayarsa bu hamle standart baslangica gore (beyazin
    sirasi) degerlendirilir ve YANLISLIKLA reddedilir."""
    token, child_id = child_auth
    acilis_fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    start = await client.post(
        "/games/bot/start",
        headers={"Authorization": f"Bearer {token}"},
        json={"skill_level": 5, "start_fen": acilis_fen},
    )
    gid = start.json()["game_id"]

    response = await client.post(
        f"/games/{gid}/move",
        headers={"Authorization": f"Bearer {token}"},
        json={"move_uci": "e7e5"},
    )
    assert response.status_code == 200
    assert response.json()["accepted"] is True
