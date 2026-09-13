# Madde 2026-09-13 (Sınıflarım): sporcu KENDİ profilinden antrenörün
# oluşturduğu sınıfın kodunu girerek sınıfa katılır (POST /children/me/
# join-class — parent.py'deki aynı isimli veli-tarafı ucun sporcu-tarafı
# ikizi). Profil (/gamification/me, /teacher/students/{id}/profile-summary)
# katıldığı sınıfın bilgisini (class_info) döner — bkz. test_coach_notes.py
# ile AYNI desen (coach_note ile paralel bir alan).
import pytest
from tests.test_notifications import _child_login, ch
from tests.test_homework import _teacher2, auth


@pytest.mark.asyncio
async def test_sporcu_kendi_koduyla_sinifa_katilir(client):
    tok, _ = await _teacher2(client, "sin1@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Sınıf X"})
    join_code = r.json()["join_code"]

    ctok, _ = await _child_login(client, "sin1a@t.com", "Ayşe")
    r = await client.post("/children/me/join-class", headers=ch(ctok), json={"join_code": join_code})
    assert r.status_code == 200, r.text
    assert r.json() == {"joined": True, "class_name": "Sınıf X"}


@pytest.mark.asyncio
async def test_yanlis_kod_404(client):
    ctok, _ = await _child_login(client, "sin2a@t.com")
    r = await client.post("/children/me/join-class", headers=ch(ctok), json={"join_code": "YOKYOKYOK"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_katilmadan_once_class_info_null_katilinca_dolar(client):
    tok, _ = await _teacher2(client, "sin3@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Sınıf Y"})
    join_code = r.json()["join_code"]

    ctok, _ = await _child_login(client, "sin3a@t.com", "Mehmet")
    me = await client.get("/gamification/me", headers=ch(ctok))
    assert me.json()["class_info"] is None

    r = await client.post("/children/me/join-class", headers=ch(ctok), json={"join_code": join_code})
    assert r.status_code == 200, r.text

    me2 = await client.get("/gamification/me", headers=ch(ctok))
    assert me2.json()["class_info"] == {
        "class_name": "Sınıf Y", "teacher_name": "Hoca", "student_count": 1,
    }


@pytest.mark.asyncio
async def test_kod_kucuk_harfle_girilse_de_calisir(client):
    tok, _ = await _teacher2(client, "sin4@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Sınıf Z"})
    join_code = r.json()["join_code"]

    ctok, _ = await _child_login(client, "sin4a@t.com")
    r = await client.post("/children/me/join-class", headers=ch(ctok), json={"join_code": join_code.lower()})
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_antrenor_ogrenci_profilinde_de_sinif_bilgisi_gorunur(client):
    tok, _ = await _teacher2(client, "sin5@t.com")
    r = await client.post("/teacher/classes", headers=auth(tok), json={"name": "Sınıf W"})
    join_code = r.json()["join_code"]

    ctok, cid = await _child_login(client, "sin5a@t.com", "Zeynep")
    await client.post("/children/me/join-class", headers=ch(ctok), json={"join_code": join_code})

    r = await client.get(f"/teacher/students/{cid}/profile-summary", headers=auth(tok))
    assert r.status_code == 200, r.text
    assert r.json()["class_info"]["class_name"] == "Sınıf W"
