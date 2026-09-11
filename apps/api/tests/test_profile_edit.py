# Madde 2026-09-11 (Görsel Turu Aşama B / Madde 3 + 11): sporcu ve antrenör
# kendi profilini düzenler (ülke/şehir/telefon/Lichess/nickname); nickname
# 3 ayda 1, benzersiz; maçlarda gerçek isim yerine nickname görünür.
import pytest
from datetime import datetime, timedelta
from chess_api.models import ChildProfile, User
from chess_api.services.jwt import decode_token
from tests.test_notifications import _child_login, ch
from tests.test_homework import _teacher2, auth


@pytest.mark.asyncio
async def test_sporcu_iletisim_ve_yer_bilgilerini_duzenler(client, db):
    tok, cid = await _child_login(client, "pe1@t.com", "Ali Veli")
    r = await client.patch("/children/me/profile", headers=ch(tok), json={
        "country": "Türkiye", "province": "Bilecik", "athlete_phone": "0555 111 22 33",
        "lichess_username": "aliveli",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["province"] == "Bilecik"
    assert body["athlete_phone"] == "0555 111 22 33"
    assert body["lichess_username"] == "aliveli"
    assert body["country"] == "Türkiye"
    # İsim DEĞİŞMEDİ (şemada yok).
    child = await db.get(ChildProfile, cid)
    assert child.display_name == "Ali Veli"

    # Boş string → temizler; gönderilmeyen alan (province) DEĞİŞMEZ.
    r2 = await client.patch("/children/me/profile", headers=ch(tok), json={"athlete_phone": ""})
    assert r2.json()["athlete_phone"] is None
    assert r2.json()["province"] == "Bilecik"


@pytest.mark.asyncio
async def test_nickname_ilk_kez_serbest_sonra_3_ay_kilit(client, db):
    tok, cid = await _child_login(client, "pe2@t.com")
    r = await client.patch("/children/me/profile", headers=ch(tok), json={"nickname": "Şahin"})
    assert r.status_code == 200, r.text
    assert r.json()["nickname"] == "Şahin"
    assert r.json()["nickname_next_change_at"] is not None

    r2 = await client.patch("/children/me/profile", headers=ch(tok), json={"nickname": "Kartal"})
    assert r2.status_code == 409
    assert "gün sonra" in r2.json()["detail"]

    # 91 gün önce değiştirilmiş gibi yap → tekrar değiştirilebilir.
    child = await db.get(ChildProfile, cid)
    child.nickname_changed_at = datetime.utcnow() - timedelta(days=91)
    await db.commit()
    r3 = await client.patch("/children/me/profile", headers=ch(tok), json={"nickname": "Kartal"})
    assert r3.status_code == 200
    assert r3.json()["nickname"] == "Kartal"


@pytest.mark.asyncio
async def test_ayni_nickname_tekrar_gonderilince_sayac_islemez(client, db):
    tok, cid = await _child_login(client, "pe3@t.com")
    await client.patch("/children/me/profile", headers=ch(tok), json={"nickname": "Fil"})
    child = await db.get(ChildProfile, cid)
    first = child.nickname_changed_at
    r = await client.patch("/children/me/profile", headers=ch(tok), json={"nickname": "fil"})
    assert r.status_code == 200
    await db.refresh(child)
    assert child.nickname_changed_at == first  # no-op, kilit yenilenmedi


@pytest.mark.asyncio
async def test_nickname_benzersiz_buyuk_kucuk_harf_duyarsiz(client, db):
    tok1, _ = await _child_login(client, "pe4a@t.com")
    tok2, _ = await _child_login(client, "pe4b@t.com")
    await client.patch("/children/me/profile", headers=ch(tok1), json={"nickname": "Vezir"})
    r = await client.patch("/children/me/profile", headers=ch(tok2), json={"nickname": "vezir"})
    assert r.status_code == 409
    assert "kullanılıyor" in r.json()["detail"]


@pytest.mark.asyncio
async def test_gecersiz_nickname_422(client, db):
    tok, _ = await _child_login(client, "pe5@t.com")
    assert (await client.patch("/children/me/profile", headers=ch(tok), json={"nickname": "a"})).status_code == 422
    assert (await client.patch("/children/me/profile", headers=ch(tok), json={"nickname": "kötü@ad!"})).status_code == 422


@pytest.mark.asyncio
async def test_gamification_me_nickname_ve_ulke_doner(client, db):
    tok, _ = await _child_login(client, "pe6@t.com")
    await client.patch("/children/me/profile", headers=ch(tok), json={"nickname": "At", "country": "Türkiye"})
    r = await client.get("/gamification/me", headers=ch(tok))
    assert r.json()["nickname"] == "At"
    assert r.json()["country"] == "Türkiye"
    assert r.json()["nickname_next_change_at"] is not None


@pytest.mark.asyncio
async def test_antrenor_profilini_duzenler_nickname_oyun_profilinde(client, db):
    tok, teacher_id = await _teacher2(client, "pe7@t.com")
    r = await client.patch("/teacher/me/profile", headers=auth(tok), json={
        "country": "Türkiye", "province": "Eskişehir", "phone": "0532", "lichess_username": "hocam",
        "nickname": "Hoca",
    })
    assert r.status_code == 200, r.text
    assert r.json()["nickname"] == "Hoca"
    assert r.json()["province"] == "Eskişehir"
    u = await db.get(User, teacher_id)
    assert u.province == "Eskişehir" and u.phone == "0532" and u.country == "Türkiye"
    assert u.name == "Hoca"  # isim DEĞİŞMEDİ (signup'taki "Hoca")
    play_id = decode_token(tok)["child_profile_id"]
    play = await db.get(ChildProfile, play_id)
    assert play.nickname == "Hoca"

    s = await client.get("/teacher/me/profile-summary", headers=auth(tok))
    assert s.json()["nickname"] == "Hoca"
    assert s.json()["country"] == "Türkiye"


@pytest.mark.asyncio
async def test_maclarda_nickname_gorunur(client, db):
    """Madde 11: lobi listesi, maç geçmişi ve bot maçı başlangıcı nickname döner."""
    tok, teacher_id = await _teacher2(client, "pe8@t.com")
    t1, c1 = await _child_login(client, "pe8a@t.com", "Ayşe Yılmaz")
    t2, c2 = await _child_login(client, "pe8b@t.com", "Mehmet Kaya")
    for cid in (c1, c2):
        child = await db.get(ChildProfile, cid)
        child.teacher_user_id = teacher_id
    await db.commit()
    await client.patch("/children/me/profile", headers=ch(t2), json={"nickname": "Kaya"})

    # /athletes (lobi): c1, c2'yi nickname ile görür; c2 için "Kaya".
    r = await client.get("/athletes", headers=ch(t1))
    names = {a["child_id"]: a["display_name"] for a in r.json()}
    assert names[c2] == "Kaya"

    # Bot maçı başlangıcı: kendi adı (nickname yoksa gerçek isim).
    b = await client.post("/games/bot/start", headers=ch(t2), json={"skill_level": 1})
    assert b.status_code == 200, b.text
    assert b.json()["player_name"] == "Kaya"
    b1 = await client.post("/games/bot/start", headers=ch(t1), json={"skill_level": 1})
    assert b1.json()["player_name"] == "Ayşe Yılmaz"

    # Maç geçmişi (BİTMİŞ maçlar) — white_name da nickname.
    from chess_api.models import Game, GameStatus, GameResult
    game = await db.get(Game, b.json()["game_id"])
    game.status = GameStatus.finished
    game.result = GameResult.white_wins
    await db.commit()
    g = await client.get("/games", headers=ch(t2))
    assert g.status_code == 200
    assert g.json()[0]["white_name"] == "Kaya"


@pytest.mark.asyncio
async def test_antrenor_lobide_ogrencilerini_gorur_ogrenci_de_antrenoru(client, db):
    """Aşama B canlı kontrolünde bulunan F boşluğu: antrenörün oyun profili
    kendi hoca grubuna bağlı (teacher_user_id = kendi id'si) → lobi simetrik."""
    tok, teacher_id = await _teacher2(client, "pe9@t.com")
    t1, c1 = await _child_login(client, "pe9a@t.com", "Ayşe Yılmaz")
    child = await db.get(ChildProfile, c1)
    child.teacher_user_id = teacher_id
    await db.commit()
    await client.patch("/teacher/me/profile", headers=auth(tok), json={"nickname": "HocaNick"})

    r = await client.get("/athletes", headers=auth(tok))
    assert r.status_code == 200
    assert [a["display_name"] for a in r.json()] == ["Ayşe Yılmaz"]

    r2 = await client.get("/athletes", headers=ch(t1))
    assert [a["display_name"] for a in r2.json()] == ["HocaNick"]
